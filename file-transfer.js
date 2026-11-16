const treeDropArea = document.getElementById('directory-view');
const maxTreeCopyBytes = 256 * 1024 * 1024;
let treeTransferBusy = false;
let highlightedDropTarget = null;

function copyTool(name, args) {
  if (viewerDisposed) throw new Error('文件树已关闭');
  return request('tools/call', {name, arguments: args}).then(unwrapWorkspace);
}

async function writeTreeCopy(parent, name, size, session, nextChunk, onProgress) {
  const begin = await copyTool('write_workspace_copy', {action:'begin', parent, name, size, workspaceSession:session});
  const {ticket, chunkBytes} = begin;
  if (typeof ticket !== 'string' || !Number.isSafeInteger(chunkBytes) || chunkBytes < 1 || chunkBytes > 512 * 1024) {
    throw new Error('文件复制服务返回了无效会话');
  }
  const args = {ticket, workspaceSession:session};
  try {
    let offset = 0;
    while (offset < size) {
      const chunk = await nextChunk(offset, chunkBytes);
      if (!Number.isSafeInteger(chunk.offset) || chunk.offset <= offset || chunk.offset > size) {
        throw new Error('读取到不完整的文件分块');
      }
      const written = await copyTool('write_workspace_copy', {...args, action:'append', offset, data:chunk.data});
      if (written.offset !== chunk.offset) throw new Error('文件复制位置不一致');
      offset = written.offset;
      onProgress(offset, size);
    }
    const copied = await copyTool('write_workspace_copy', {...args, action:'finish'});
    if (!copied.created) throw new Error('未收到复制结果，请刷新目录确认');
    return copied;
  } catch (error) {
    // Best-effort cleanup of this transfer only. Never resend a write after an uncertain result.
    if (!viewerDisposed) request('tools/call', {name:'write_workspace_copy', arguments:{...args, action:'abort'}}).catch(()=>{});
    throw error;
  }
}

function readDroppedChunk(file, offset, size) {
  const end = Math.min(offset + size, file.size);
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({offset:end, data:reader.result.split(',', 2)[1]});
    reader.onerror = () => reject(new Error('无法读取拖入的文件'));
    reader.onabort = () => reject(new Error('文件读取已取消'));
    reader.readAsDataURL(file.slice(offset, end));
  });
}

function treeCopyProgress(label, name, offset, size) {
  directoryNotice(label + ' ' + name + ' · ' + Math.floor(offset / size * 100) + '%');
}

async function importTreeFiles(files, node, rejectedDirectories) {
  if (treeTransferBusy || viewerDisposed) return;
  if (!files.length) {
    if (rejectedDirectories) directoryNotice('请拖入文件，当前支持单个或多个普通文件。', true);
    return;
  }
  treeTransferBusy = true;
  const session = workspaceSession ?? null;
  const epoch = directoryGeneration;
  const failures = [];
  let copied = 0;
  try {
    for (const file of files) {
      if (viewerDisposed) return;
      try {
        if (file.size > maxTreeCopyBytes) throw new Error('超过 256 MiB');
        directoryNotice('正在复制 ' + file.name);
        await writeTreeCopy(node.path, file.name, file.size, session,
          (offset, size) => readDroppedChunk(file, offset, size),
          (offset, size) => treeCopyProgress('正在复制', file.name, offset, size));
        copied++;
      } catch (error) {
        failures.push(file.name + '：' + error.message);
      }
    }
    if (viewerDisposed) return;
    if (copied && epoch === directoryGeneration && session === (workspaceSession ?? null) &&
        directoryNodes.get(pathKey(node.path)) === node) {
      node.expanded = true;
      await loadDirectoryNode(node, true);
    }
    const detail = failures.length ? '。失败：' + failures.join('；') : '';
    const skipped = rejectedDirectories ? '。已跳过 ' + rejectedDirectories + ' 个文件夹' : '';
    directoryNotice('已复制 ' + copied + ' 个文件到 ' + node.path + detail + skipped, !!failures.length);
  } finally {
    treeTransferBusy = false;
  }
}

async function exportTreeFile(node) {
  if (treeTransferBusy || launcherBusy || viewerDisposed) return;
  treeTransferBusy = true;
  const source = {path:node.path, workspaceSession:workspaceSession ?? null};
  try {
    const destination = await pickWorkspacePath('export-directory');
    if (!destination || destination.cancelled || viewerDisposed) return;
    if (!destination.directory?.path || typeof destination.session !== 'string') throw new Error('无法确认本机导出位置');
    directoryNotice('正在导出 ' + node.name);
    const first = await copyTool('read_workspace_copy', {...source, offset:0});
    const copied = await writeTreeCopy(destination.directory.path, first.name, first.size, destination.session,
      offset => offset ? copyTool('read_workspace_copy', {...source, offset, revision:first.revision}) : first,
      (offset, size) => treeCopyProgress('正在导出', node.name, offset, size));
    if (!viewerDisposed) directoryNotice('已导出到 ' + copied.path);
  } catch (error) {
    if (!viewerDisposed) directoryNotice('导出失败：' + error.message, true);
  } finally {
    treeTransferBusy = false;
  }
}

function externalFiles(event) {
  return Array.from(event.dataTransfer?.types || []).includes('Files');
}

function targetForDrop(event) {
  const button = event.target.closest('.directory-entry');
  if (!button) return directoryRoot;
  const node = directoryNodeByButton.get(button);
  return node?.kind === 'directory' ? node : null;
}

function highlightTreeDrop(node) {
  const element = node === directoryRoot && node ? treeDropArea : node?.button || null;
  if (element === highlightedDropTarget) return;
  highlightedDropTarget?.classList.remove('file-drop-target');
  highlightedDropTarget = element;
  highlightedDropTarget?.classList.add('file-drop-target');
}

treeDropArea.addEventListener('dragover', event => {
  if (!externalFiles(event)) return;
  event.preventDefault();
  const node = treeTransferBusy ? null : targetForDrop(event);
  event.dataTransfer.dropEffect = node ? 'copy' : 'none';
  highlightTreeDrop(node);
});
treeDropArea.addEventListener('dragleave', event => {
  if (!event.relatedTarget || !treeDropArea.contains(event.relatedTarget)) highlightTreeDrop(null);
});
treeDropArea.addEventListener('drop', event => {
  if (!externalFiles(event)) return;
  event.preventDefault();
  event.stopPropagation();
  highlightTreeDrop(null);
  const node = targetForDrop(event);
  if (!node || treeTransferBusy || directoryNodes.get(pathKey(node.path)) !== node) return;
  const items = Array.from(event.dataTransfer.items || []).filter(item => item.kind === 'file');
  let rejectedDirectories = 0;
  const files = items.length ? items.flatMap(item => {
    if (item.webkitGetAsEntry?.()?.isDirectory) {
      rejectedDirectories++;
      return [];
    }
    const file = item.getAsFile();
    return file ? [file] : [];
  }) : Array.from(event.dataTransfer.files || []);
  if (files.length > 32) {
    directoryNotice('一次最多复制 32 个文件，请分批拖入。', true);
    return;
  }
  void importTreeFiles(files, node, rejectedDirectories);
});
window.addEventListener('blur', () => highlightTreeDrop(null));
