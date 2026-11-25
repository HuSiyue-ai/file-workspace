// 重载已安装的界面和兼容后台，保留当前标签状态。
const pluginReloadButton=document.getElementById('plugin-reload');
const pluginUpdateStatus=document.getElementById('plugin-update-status');
let pluginReloadBusy=false,pluginResumeState=workspaceResume,pluginReloadRestoring=false;
document.getElementById('workspace-resume')?.remove();
function pluginUpdateNotice(text,isError=false){pluginUpdateStatus.hidden=!text;pluginUpdateStatus.textContent=text;pluginUpdateStatus.classList.toggle('error',isError);}
function captureWorkspaceReload(){
  return {schema:1,anchorFile,activePath:activeFile?.path||null,workspaceSession,hostInitialization:viewerHostInitialization,
    roots:workspaceRootChoices,selectedRoot:selectedWorkspaceRoot,
    history:typeof workspaceHistory==='undefined'?null:{locations:workspaceHistory,index:workspaceHistoryIndex},
    directory:{visible:!directoryPanel.hidden,mode:navigationMode,root:directoryRoot?.path,
      expanded:[...directoryNodes.values()].filter(node=>node.kind==='directory'&&node.expanded).map(node=>node.path).slice(0,2000),
      filter:document.getElementById('directory-filter').value,top:directoryList.scrollTop,width:preferredDirectoryWidth},
    top:document.getElementById('document-area').scrollTop,font:document.getElementById('size').value,
    comments:excerptComments,nextComment:excerptCommentNext,theme:document.documentElement.dataset.theme,
    nextId:nextId+100,mode:displayMode};
}
function ignoreReloadHostFile(file){return !!(pluginReloadRestoring||pluginResumeState)&&file?.resourceUri===((pluginResumeState?.anchorFile||anchorFile)?.resourceUri);}
async function resumeReloadedWorkspace(){
  const state=pluginResumeState;if(!state||state.schema!==1)return false;
  pluginReloadRestoring=true;cancelWorkspaceHome();
  try{
    nextId=Math.max(nextId,Number(state.nextId)||0);
    workspaceSession=state.workspaceSession;anchorFile=state.anchorFile;
    setWorkspaceRootChoices(state.roots||[]);selectedWorkspaceRoot=state.selectedRoot;rebuildProjectRootMenu();
    if(state.theme)theme({theme:state.theme});
    let previewRestored=true,directoryRestored=true;
    if(state.activePath&&anchorFile)previewRestored=!!await previewPath(state.activePath,false);
    else if(anchorFile)showEmptyWorkspace('单击右侧文件树中的文件，在这里预览。');
    if(viewerDisposed)return true;
    const restoredEpoch=readGeneration,restoredAnchor=anchorFile;
    const current=()=>!viewerDisposed&&readGeneration===restoredEpoch&&anchorFile===restoredAnchor;
    const directory=state.directory||{};
    if(Number.isFinite(directory.width))applyDirectoryWidth(directory.width);
    // Restore loaded branches even when the panel was closed or showing the outline.
    if(anchorFile&&(directory.root||(directory.visible&&directory.mode==='files'))){
      directoryRestored=await loadDirectory(directory.root);
      if(!current())return true;
      if(directoryRestored){
        const paths=(directory.expanded||[]).slice().sort((a,b)=>a.length-b.length);
        for(const path of paths){
          if(!current())return true;
          const node=directoryNodes.get(pathKey(path));
          if(node&&node!==directoryRoot){
            await setFolderExpanded(node,true);
            if(node.error)directoryRestored=false;
          }
        }
        if(!current())return true;
        document.getElementById('directory-filter').value=directory.filter||'';renderDirectory();
      }
    }
    setDirectoryVisible(!!directory.visible,directory.mode,false);
    document.getElementById('size').value=state.font||'16';preview.style.fontSize=(state.font||'16')+'px';
    excerptComments=Array.isArray(state.comments)?state.comments:[];excerptCommentNext=state.nextComment||0;renderExcerptComments();
    if(activeFile?.kind==='markdown'&&['edit','source'].includes(state.mode))await changeDocumentMode(state.mode);
    const restoreScroll=()=>{if(!current())return;document.getElementById('document-area').scrollTop=state.top||0;directoryList.scrollTop=directory.top||0;scheduleExcerptMarkers();};
    restoreScroll();requestAnimationFrame(restoreScroll);
    if(typeof restoreWorkspaceHistory==='function')restoreWorkspaceHistory(state.history);
    const version=document.querySelector('meta[name="workspace-version"]').content;
    const failed=[...(!previewRestored?['预览']:[]),...(!directoryRestored?['文件树']:[])];
    pluginUpdateNotice(failed.length
      ?'界面已重载 · v'+version+'，'+failed.join('和')+'未能完整恢复。请查看读取提示。'
      :'已在当前标签重载插件 · v'+version+(state.backendReloaded?' · 后台已更新':''),failed.length>0);
    if(!anchorFile)setTimeout(showLauncherHome,0);
    return true;
  }catch(error){pluginUpdateNotice('界面已重载，恢复位置时遇到问题：'+error.message,true);return true;}
  finally{pluginReloadRestoring=false;pluginResumeState=null;}
}
function workspaceOperationInProgress(){
  return launcherBusy||rootSwitchBusy||excerptCommentsBusy||selectionBusy||folderCreateBusy||
    (typeof treeTransferBusy!=='undefined'&&treeTransferBusy)||
    (typeof recycleOperationBusy!=='undefined'&&recycleOperationBusy)||editorSession?.saving;
}
async function reloadWorkspacePlugin(){
  if(pluginReloadBusy||viewerDisposed||(typeof historyNavigationBusy!=='undefined'&&historyNavigationBusy)||
      (typeof pinOperationBusy!=='undefined'&&pinOperationBusy))return;
  if(workspaceOperationInProgress()){pluginUpdateNotice('请等待当前操作完成后再重载。');return;}
  pluginReloadBusy=true;pluginReloadButton.disabled=true;
  let previousMode, previousTop, editorClosed=false;
  const body=document.body;
  try{
    pluginUpdateNotice('正在检查已安装的插件…');
    const response=await request('tools/call',{name:'read_workspace_update',arguments:{}});
    if(viewerDisposed)return;
    let data=unwrapWorkspace(response);
    if(data.restartRequired){pluginUpdateNotice('已安装 v'+data.uiVersion+'，需要重启 Codex 以重新建立插件连接。',true);return;}
    if(workspaceOperationInProgress()){pluginUpdateNotice('请等待当前操作完成后再重载。');return;}
    if(quickCommentDraft&&!confirmQuickExcerptComment()){pluginUpdateNotice('请先处理评论框中的提示，再重载插件。',true);return;}
    previousMode=displayMode;
    previousTop=document.getElementById('document-area').scrollTop;
    if(!await confirmEditorNavigation()||viewerDisposed)return;
    editorClosed=true;
    if(workspaceOperationInProgress())throw new Error('请等待当前操作完成后再重载');
    const state=captureWorkspaceReload();
    state.mode=previousMode;state.top=previousTop;
    if(data.backendUpdateAvailable){
      pluginUpdateNotice('正在验证并切换插件后台…');
      body.inert=true;
      data=unwrapWorkspace(await request('tools/call',{name:'read_workspace_update',arguments:{apply:true}}));
      if(viewerDisposed)return;
      if(data.restartRequired)throw new Error('启动配置已改变，需要重新建立插件连接');
      state.backendReloaded=!!data.backendReloaded;
    }
    if(typeof data.html!=='string'||!data.html.includes('id="plugin-reload"')||!data.html.includes('workspace-version'))
      throw new Error('未收到支持重载的完整插件界面');
    const json=JSON.stringify(state).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');
    const html=data.html.replace('<body>',()=>'<body><script type="application/json" id="workspace-resume">'+json+'</script>');
    if(html===data.html)throw new Error('插件界面不支持保存当前工作区状态');
    // Existing pagehide handlers dispose timers, observers, drafts and owned requests.
    window.dispatchEvent(new Event('pagehide'));
    document.open();document.write(html);document.close();
  }catch(error){
    if(body)body.inert=false;
    if(!viewerDisposed){
      pluginUpdateNotice('重载失败 · '+error.message+'。当前页面已保留。',true);
      if(editorClosed&&['edit','source'].includes(previousMode)&&typeof changeDocumentMode==='function'){
        await changeDocumentMode(previousMode);
        document.getElementById('document-area').scrollTop=previousTop;
      }
    }
  }finally{
    if(body)body.inert=false;
    pluginReloadBusy=false;
    if(!viewerDisposed)pluginReloadButton.disabled=false;
  }
}
pluginReloadButton.addEventListener('click',reloadWorkspacePlugin);
pluginReloadButton.title+=' · 当前界面 v'+document.querySelector('meta[name="workspace-version"]').content;
