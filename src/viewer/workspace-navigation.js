// Pins persist in the backend. Navigation history belongs to this preview tab.
let pinnedFolders = [];
let pinMenuRequest = 0;
let pinOperationBusy = false;
const historyBackButton = document.getElementById('directory-back');
const historyForwardButton = document.getElementById('directory-forward');
const maxWorkspaceHistory = 50;
let workspaceHistory = [];
let workspaceHistoryIndex = -1;
let historyNavigationBusy = false;

async function callWorkspacePins(action, args = {}) {
  return unwrapWorkspace(await request('tools/call', {
    name: 'manage_workspace_pins', arguments: {action, ...args}
  }));
}

async function updatePinnedFolders(action = 'list', args = {}) {
  const requestId = ++pinMenuRequest;
  const {pins} = await callWorkspacePins(action, args);
  if (!viewerDisposed && requestId === pinMenuRequest && Array.isArray(pins)) {
    pinnedFolders = pins;
    rebuildProjectRootMenu();
  }
}

function loadPinnedFolders() {
  if (!pinOperationBusy) void updatePinnedFolders().catch(error => {
    if (!projectRootMenu.hidden && !viewerDisposed) directoryNotice('无法读取常用文件夹：' + error.message, true);
  });
}

async function changePinnedFolders(action, args) {
  if (pinOperationBusy || viewerDisposed) return;
  pinOperationBusy = true;
  try {
    if (action === 'choose') {
      await pickWorkspacePath('directory', async data => {
        if (!data.cancelled && data.directory) {
          await updatePinnedFolders('pin', {path: data.directory.path, workspaceSession: data.session});
          directoryNotice('已固定 · ' + pathName(data.directory.path));
        }
      });
    } else {
      await updatePinnedFolders(action, args);
      directoryNotice(action === 'pin' ? '已固定 · ' + pathName(args.path) : '已取消固定');
    }
  } catch (error) {
    if (!viewerDisposed) directoryNotice('常用文件夹操作失败：' + error.message, true);
  } finally {
    pinOperationBusy = false;
  }
}

function pinnedMatches(pin, directory, path = directory?.path) {
  const profile = directory?.host ? directory.resourceUri?.split('/').at(-1) : '';
  return pathKey(pin.path) === pathKey(path) && pin.host === (directory?.host || '') && pin.profile === profile;
}

function appendWorkspacePins(menu) {
  const button = (label, key, callback) => {
    const element = document.createElement('button');
    element.type = 'button';
    element.textContent = label;
    element.disabled = rootSwitchBusy;
    element.setAttribute('role', 'menuitem');
    element.workspaceRootMenuKey = key;
    element.addEventListener('click', callback);
    return element;
  };
  if (menu.children.length) menu.append(document.createElement('hr'));
  const heading = document.createElement('div');
  heading.className = 'pin-menu-heading';
  heading.textContent = '常用文件夹';
  menu.append(heading);
  for (const pin of pinnedFolders) {
    const row = document.createElement('div');
    row.className = 'pin-menu-row';
    const label = (pin.host ? pin.host + ' · ' : '') + pin.name;
    const open = button('📌  ' + label, 'pin:' + pin.id, () => {
      void switchWorkspaceRoot(null, async () => ({
        ...await callWorkspacePins('open', {id: pin.id}), pinned: true
      }));
    });
    open.title = pin.path;
    const remove = button('×', 'unpin:' + pin.id, () => {
      setProjectRootMenuVisible(false);
      void changePinnedFolders('unpin', {id: pin.id});
    });
    remove.title = '取消固定 ' + label;
    remove.setAttribute('aria-label', remove.title);
    row.append(open, remove);
    menu.append(row);
  }
  const path = directoryRoot?.path;
  if (path && !pinnedFolders.some(pin => pinnedMatches(pin, anchorFile, path))) {
    menu.append(button('固定当前文件夹', 'pin-current', () => {
      setProjectRootMenuVisible(false);
      void changePinnedFolders('pin', {path, ...(workspaceSession ? {workspaceSession} : {})});
    }));
  }
  menu.append(button('添加常用文件夹…', 'pin-choose', () => {
    setProjectRootMenuVisible(false);
    void changePinnedFolders('choose');
  }));
  menu.append(document.createElement('hr'));
}

function workspaceHistoryButtons() {
  historyBackButton.disabled = historyNavigationBusy || workspaceHistoryIndex < 1;
  historyForwardButton.disabled = historyNavigationBusy || workspaceHistoryIndex >= workspaceHistory.length - 1;
}

function workspaceLocationKey(entry) {
  return JSON.stringify([entry.anchor.host || '', entry.anchor.host ? entry.anchor.resourceUri : '',
    pathKey(entry.root), pathKey(entry.file)]);
}

function recordWorkspaceLocation() {
  if (!anchorFile || !workspaceSession) return;
  const entry = {anchor: anchorFile, session: workspaceSession, root: directoryRoot?.path || null,
    file: activeFile?.path || null, selectedRoot: selectedWorkspaceRoot};
  if (!entry.root && !entry.file) return;
  const previous = workspaceHistory[workspaceHistoryIndex];
  if (previous && workspaceLocationKey(previous) === workspaceLocationKey(entry)) {
    workspaceHistory[workspaceHistoryIndex] = entry;
    return;
  }
  workspaceHistory = [...workspaceHistory.slice(0, workspaceHistoryIndex + 1), entry].slice(-maxWorkspaceHistory);
  workspaceHistoryIndex = workspaceHistory.length - 1;
  workspaceHistoryButtons();
}

function restoreWorkspaceHistory(history) {
  if (Array.isArray(history?.locations) && Number.isInteger(history.index) &&
      history.index >= 0 && history.index < history.locations.length) {
    workspaceHistory = history.locations;
    workspaceHistoryIndex = history.index;
  }
  recordWorkspaceLocation();
  workspaceHistoryButtons();
}

async function readHistoryLocation(entry) {
  const read = async () => {
    const call = async (name, args) => unwrapWorkspace(await request('tools/call', {
      name, arguments: {...args, workspaceSession: entry.session}
    }));
    const directory = await call('list_markdown_directory', {
      ...(entry.root ? {directory: entry.root} : {})
    });
    if (typeof directory.directory !== 'string' || !Array.isArray(directory.entries)) {
      throw new Error('未收到目录内容');
    }
    const file = entry.file ? await call('read_preview_file', {path: entry.file}) : null;
    if (entry.file && !isPreviewData(file)) throw new Error('未收到可预览的文件内容');
    return {directory, file};
  };
  try {
    return await read();
  } catch (error) {
    if (!workspaceSessionExpired(error) || entry.anchor.kind !== 'directory' || viewerDisposed) throw error;
    const fresh = await findFreshWorkspaceChoice(entry.anchor);
    if (!fresh || viewerDisposed) throw error;
    entry.session = fresh.session;
    return read();
  }
}

async function navigateWorkspaceHistory(direction) {
  const index = workspaceHistoryIndex + direction;
  const entry = workspaceHistory[index];
  if (!entry || historyNavigationBusy || workspaceOperationInProgress() || pluginReloadBusy ||
      loadingPreviewPath || viewerDisposed) return;
  historyNavigationBusy = true;
  workspaceHistoryButtons();
  cancelPendingFilePreview();
  const previous = {anchor: anchorFile, read: readGeneration, tree: directoryRootRequest};
  const current = () => !viewerDisposed && previous.anchor === anchorFile &&
    previous.read === readGeneration && previous.tree === directoryRootRequest;
  try {
    if (!await confirmEditorNavigation() || !current()) return;
    directoryNotice('正在打开浏览历史…');
    const {directory, file} = await readHistoryLocation(entry);
    if (!current() || !await confirmEditorNavigation() || !current()) return;
    cancelWorkspaceHome();
    cancelPendingFilePreview();
    workspaceSession = entry.session;
    anchorFile = entry.anchor;
    selectedWorkspaceRoot = entry.selectedRoot;
    const generation = ++readGeneration;
    loadingPreviewPath = null;
    setDirectoryVisible(true, 'files', false);
    if (file) {
      replaceDirectoryData(directory);
      if (!await displayReadPreview(file, generation, true)) return;
    } else {
      resetWorkspacePreview();
      replaceDirectoryData(directory);
    }
    if (viewerDisposed || generation !== readGeneration) return;
    workspaceHistoryIndex = index;
    if (file && pathKey(file.path).startsWith(pathKey(directory.directory) + '/')) {
      await locateCurrentFile({focus: false});
    }
  } catch (error) {
    if (!viewerDisposed) directoryNotice('无法打开历史位置：' + error.message, true);
  } finally {
    historyNavigationBusy = false;
    workspaceHistoryButtons();
  }
}

historyBackButton.addEventListener('click', () => void navigateWorkspaceHistory(-1));
historyForwardButton.addEventListener('click', () => void navigateWorkspaceHistory(1));
rebuildProjectRootMenu();
