import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { JSDOM, VirtualConsole } from 'jsdom';
import { RoomStore } from '../src/core/room-store.mjs';

const repo=fileURLToPath(new URL('../',import.meta.url));
const html=readFileSync(repo+'/panel/index.html','utf8').replace('<script src="main.js"></script>','<script>'+readFileSync(repo+'/panel/main.js','utf8')+'</script>');
const tokens={background:'#111',elevated:'#191919',foreground:'#eee',muted:'#999',subtle:'#777',border:'#333',hover:'#222',selection:'#345',focus:'#79f',primary:'#eee',mutedSurface:'#222',elevatedForeground:'#fff',active:'#345',selectionForeground:'#fff',primaryForeground:'#111',primaryText:'#eee',successText:'#6f6',warningText:'#fa6',errorText:'#f66',infoText:'#6af',success:'#262',warning:'#640',error:'#800',info:'#068',font:'sans-serif',mono:'monospace',radius:'8px',fontSize:'14px'};
const errors=[];
const serviceCalls=[];
const hostCalls=[];
const nativeDialogCalls=[];
const projects=[
  {id:'p_demo',name:'Demo 项目',directory:'/workspace/demo'},
  {id:'p_other',name:'另一个项目',directory:'/workspace/other'},
];
const virtualConsole=new VirtualConsole();virtualConsole.on('jsdomError',e=>errors.push(e.message));virtualConsole.on('error',e=>errors.push(String(e)));
let dom;
const panelRoot=mkdtempSync('/tmp/opencode/room-panel-');
const store=new RoomStore();
const created=store.createRoom({projectDir:panelRoot,tempRoot:panelRoot,title:'测试讨论',members:[{role:'proposer',displayName:'提案者',model:{providerID:'probe',id:'a',name:'模型 A',providerName:'Probe',variant:'high'}},{role:'reviewer',displayName:'审查者',model:{providerID:'probe',id:'b',name:'模型 B',providerName:'Probe'}}]});
store.db.prepare("UPDATE members SET creation_status='ready' WHERE room_id=? AND kind='agent'").run(created.roomId);
store.db.prepare("UPDATE rooms SET status='ready', root_creation_status='ready' WHERE id=?").run(created.roomId);
store.post(created.roomId,{kind:'human',memberId:created.human.memberId},{text:'第一条消息'});
const room=store.roomSummary(store.room(created.roomId));
room.members=room.members.map((member,index)=>({...member,sessionId:'ses_'+member.memberId,sessionStatus:index?'running':'idle'}));
const members=room.members;
members[0].lastError='probe 返回 401：invalid api key';
members[0].failureCount=3;
members[0].wakeBackoffUntil=new Date(Date.now()+3600000).toISOString();
members[1].modelSynced=false;
let messages=store.history(room.roomId,{viewerMemberId:room.human.memberId,trackPresentation:false}).items;
let questions=[{questionId:'q_1',messageId:'m_question_1',roomSeq:2,asker:members[1],createdAt:new Date().toISOString(),status:'pending',text:'选择哪种方案？',options:['甲','乙'],preview:true},{questionId:'q_2',messageId:'m_question_2',roomSeq:3,asker:members[0],createdAt:new Date().toISOString(),status:'pending',text:'第二个问题',options:[],preview:true}];
let holdRoomRefresh = false;
let heldRoomRequestId;
function response(m,payload={}){dom.window.dispatchEvent(new dom.window.MessageEvent('message',{data:{channel:'openchamber.sdk',v:1,type:'result',id:m.id,ok:true,payload},source:dom.window.parent}));}
function mountPanel() {
 return new JSDOM(html,{runScripts:'dangerously',url:'http://local/panel/index.html',pretendToBeVisual:true,virtualConsole,beforeParse(window){
  const NativeMessageEvent = window.MessageEvent;
  window.MessageEvent = class extends NativeMessageEvent {
    constructor(type, init = {}) { super(type, init); Object.defineProperty(this, 'source', { value: init.source ?? window.parent }); }
  };
  const parent = {};
  parent.postMessage = message => {
    hostCalls.push({type:message.type,payload:message.payload});
    queueMicrotask(()=>{
       if(message.type==='hello'){window.dispatchEvent(new window.MessageEvent('message',{data:{channel:'openchamber.sdk',v:1,type:'ready',payload:{theme:{mode:'dark',tokens},locale:'zh-CN',directory:'/workspace/demo',session:null,surface:'page',item:null,connection:null,settings:{},device:{formFactor:'desktop',pointer:'fine',insets:{top:0,right:0,bottom:0,left:0},keyboard:0}}},source:window.parent}));return}
      if(message.type==='storage'){const op=message.payload.op;response({id:message.id},{op,storage:op==='get'?{op:'get',found:false}:{op}});return}
      if(message.type==='workspace-read'){response({id:message.id},{kind:'projects',state:'ready',projects});return}
      if(message.type==='workspace-subscribe'){
        response({id:message.id},{ok:true});
        queueMicrotask(()=>window.dispatchEvent(new window.MessageEvent('message',{data:{channel:'openchamber.sdk',v:1,type:'workspace',payload:{subscriptionId:message.payload.subscriptionId,snapshot:{kind:'projects',state:'ready',projects}}},source:window.parent})));
        return;
      }
      if(message.type==='workspace-unsubscribe'){response({id:message.id},{ok:true});return}
      if(message.type==='service-request'){
        const p=message.payload;let data={};
        serviceCalls.push({path:p.path,query:p.query,method:p.method,body:p.body});
        if(p.path==='/meta')data={humanName:'房主'};
        else if(p.path==='/models'){
          const directory=p.query?.directory;
          if(directory==='/workspace/other')data={models:[{providerID:'probe',id:'global',name:'全局模型',providerName:'Probe'}],source:'global'};
          else data={models:[{providerID:'probe',id:'a',name:'模型 A',variant:'high',providerName:'Probe'},{providerID:'probe',id:'b',name:'模型 B',providerName:'Probe'}],source:'project'};
        }
        else if(p.path==='/rooms')data={rooms:[room]};
        else if(p.path==='/rooms/'+room.roomId+''){
          if (holdRoomRefresh) { heldRoomRequestId = message.id; return; }
          data=room;
        }
        else if(p.path==='/rooms/'+room.roomId+'/timeline')data={items:messages,previousCursor:null,nextCursor:null};
        else if(p.path.includes('/context'))data={items:messages};
        else if(p.path==='/rooms/'+room.roomId+'/questions')data=p.query?.cursor?{items:questions.slice(1),status:'pending',nextCursor:null}:{items:questions.slice(0,1),status:'pending',nextCursor:'next-page'};
        else if(p.path==='/rooms/'+room.roomId+'/mentions')data={items:[...members.map(m=>({id:m.memberId,label:m.displayName,kind:'agent'})),{id:'@all',label:'所有人',kind:'all'}]};
        else if(p.path.startsWith('/rooms/'+room.roomId+'/members/')&&p.path.endsWith('/model')&&p.method==='POST'){const input=JSON.parse(p.body);const memberId=p.path.split('/')[4];const member=room.members.find(item=>item.memberId===memberId);if(member){member.model=input.model;member.lastError=null;member.failureCount=0;member.wakeBackoffUntil=null;}data={status:'updated',memberId,model:input.model}}
        else if(p.path==='/rooms/'+room.roomId+'/messages'&&p.method==='POST'){const input=JSON.parse(p.body);const seq=room.latestSeq+1;const message={messageId:'m_new_'+seq,roomSeq:seq,author:room.human,isOwn:true,kind:'post',createdAt:new Date().toISOString(),mentions:[],mentionAll:false,replyToMessageId:input.replyToMessageId||null,questionId:null,questionStatus:null,answerMessageId:null,label:'[#'+seq+' 房主 · 人类 · 你]',text:input.text,options:[],full:true,preview:false};messages.push(message);room.latestSeq=seq;data={status:'stored',messageId:message.messageId,roomSeq:seq,timeline:messages.slice(-8)}}
        else if(p.path.includes('/answer')){questions=[];room.pendingQuestions=0;data={status:'answered',answerMessageId:'m_answer',messageId:'m_answer',roomSeq:3}}
        else if(p.path.includes('/withdraw')){const questionId=p.path.split('/')[4];questions=questions.filter(item=>item.questionId!==questionId);room.pendingQuestions=questions.length;data={status:'withdrawn',questionId}}
         else if(p.path==='/rooms/'+room.roomId+'/end'&&p.method==='POST'){room.status='ended';room.endedAt=new Date().toISOString();data={status:'ended'}}
         else if(p.path==='/rooms/'+room.roomId+'/pause'&&p.method==='POST'){
           room.status='paused';room.pausedReason='manual';room.reminders=[{status:'submitting'}];data=room;
         }
        else if(p.path.includes('/receipts'))data={messageId:'m_1',human:null,agents:[{memberId:'m_a',displayName:'提案者',kind:'agent',readAt:new Date().toISOString(),source:'model-context'}]};
        else if(p.path==='/rooms/'+room.roomId+'/read')data={marked:1,unread:{unreadCount:0,unreadMentionCount:0,unreadMentions:[]}};
        else if(p.path==='/workspace/list')data={rootPath:room.workspaceDir,path:room.workspaceDir,relativePath:'',parentPath:null,entries:[{name:'review',path:room.workspaceDir+'/review',relativePath:'review',kind:'directory',size:null,mtime:new Date().toISOString()},{name:'a.md',path:room.workspaceDir+'/a.md',relativePath:'a.md',kind:'file',size:6,mtime:new Date().toISOString()}]};
        else if(p.path==='/workspace/read')data={path:'/tmp/opencode/Discussions/r_demo/a.md',content:'# 文档'};
        response({id:message.id},{status:200,body:JSON.stringify(data)});return}
      response({id:message.id},{ok:true});
    });
  };
  Object.defineProperty(window,'parent',{configurable:true,value:parent});
  window.IntersectionObserver=class{observe(){}disconnect(){}};
  window.ResizeObserver=class{observe(){}unobserve(){}disconnect(){}};
  if(!window.requestAnimationFrame)window.requestAnimationFrame=callback=>window.setTimeout(()=>callback(Date.now()),0);
  if(!window.cancelAnimationFrame)window.cancelAnimationFrame=id=>window.clearTimeout(id);
  window.CSS={escape:value=>String(value).replace(/["\\]/g,'\\$&')};
  window.HTMLElement.prototype.scrollIntoView=function(){};
  window.HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','')};
  window.HTMLDialogElement.prototype.close=function(){this.removeAttribute('open')};
  window.confirm=()=>{nativeDialogCalls.push('confirm');return false};window.prompt=()=>{nativeDialogCalls.push('prompt');return null};
 }});
}
dom=mountPanel();
const window=dom.window;const document=window.document;
async function waitFor(fn,label){for(let i=0;i<100;i++){if(fn())return;await new Promise(r=>setTimeout(r,20));}throw new Error('Timeout '+label+'; errors='+errors.join('\n')+'; project='+document.querySelector('#project-picker')?.textContent+'; file='+document.querySelector('#file-list')?.textContent+'; modal='+document.querySelector('#modal-content')?.textContent+'; error='+document.querySelector('#error')?.textContent)}
function chooseSdkOption(root,labelPart){
  const trigger=root.querySelector('.oc-sdk-trigger');
  trigger.click();
  const option=[...root.querySelectorAll('.oc-sdk-popup .oc-sdk-option')].find(item=>item.textContent.includes(labelPart));
  if(!option)throw new Error('Missing SDK option '+labelPart+' in '+root.textContent);
  option.click();
}
function chooseListOption(root,labelPart){
  const option=[...root.querySelectorAll('.oc-sdk-row')].find(item=>item.textContent.includes(labelPart));
  if(!option)throw new Error('Missing list option '+labelPart+' in '+root.textContent);
  option.click();
}
await waitFor(()=>document.querySelector('#room-header').textContent.includes('测试讨论'),'room header');
assert.ok(document.querySelector('#room-header').textContent.includes('根会话'),'room header shows root session');
assert.ok(document.querySelector('#room-header').textContent.includes('已就绪'),'room header shows root session readiness');
assert.ok(document.querySelector('#room-header').textContent.includes('Probe · 模型 A (high)'),'room header shows provider, model and variant');
assert.ok(document.querySelector('#room-header').textContent.includes('Probe · 模型 B'),'room header shows each member model');
const failurePill=[...document.querySelectorAll('#room-header .pill.error')].find(element=>element.textContent.includes('模型调用失败'));
assert.ok(failurePill,'member lastError shows a failure pill');
assert.ok(failurePill.textContent.includes('×3'),'failure pill shows the failure count');
assert.equal(failurePill.title,'probe 返回 401：invalid api key','failure pill title carries the full error');
assert.ok(document.querySelector('#room-header').textContent.includes('退避至'),'member wake backoff is shown');
assert.ok(document.querySelector('#room-header').textContent.includes('模型同步中'),'unsynced member model is shown');
assert.ok(document.querySelector('[data-action="change-model"][data-member="'+members[0].memberId+'"]'),'each member chip has a change-model button');
document.querySelector('[data-action="change-model"][data-member="'+members[0].memberId+'"]').click();
await waitFor(()=>document.querySelector('#modal').hasAttribute('open')&&document.querySelector('#modal-content .oc-sdk-trigger'),'member model modal');
chooseSdkOption(document.querySelector('#modal-content'),'模型 B');
document.querySelector('#modal-content [data-action="submit-member-model"]').click();
const modelPath='/rooms/'+room.roomId+'/members/'+members[0].memberId+'/model';
await waitFor(()=>serviceCalls.some(call=>call.path===modelPath&&call.method==='POST'),'member model update');
const modelCall=serviceCalls.find(call=>call.path===modelPath&&call.method==='POST');
assert.deepEqual(JSON.parse(modelCall.body),{model:{providerID:'probe',id:'b',name:'模型 B',providerName:'Probe'}},'member model update matches the service request contract');
await waitFor(()=>!document.querySelector('#modal').hasAttribute('open'),'member model modal closes');
await waitFor(()=>hostCalls.some(call=>call.type==='toast'&&call.payload?.message.includes('更换为')),'member model toast');
await waitFor(()=>[...document.querySelectorAll('#room-header .member-chip')].some(chip=>chip.textContent.includes('提案者')&&chip.textContent.includes('Probe · 模型 B')),'member model refreshed');
document.querySelector('[data-action="open-workspace"]').click();
await waitFor(()=>document.querySelectorAll('#file-list .oc-sdk-row').length===2,'SDK workspace file list');
assert.ok(document.querySelector('#file-list').textContent.includes('a.md'),'file list shows room files');
assert.ok(document.querySelector('#file-list').textContent.includes('review'),'file list shows room directories');
chooseListOption(document.querySelector('#file-list'),'a.md');
await waitFor(()=>document.querySelector('#file-preview-content').textContent.includes('# 文档'),'SDK text file preview');
assert.ok(serviceCalls.some(call=>call.path==='/workspace/list'),'workspace list endpoint is used');
document.querySelector('[data-action="close-modal"]').click();
const rootSessionButton=document.querySelector('[data-action="open-root-session"]');
assert.ok(rootSessionButton,'root session button is present');
assert.equal(rootSessionButton.dataset.session,room.rootSessionId);
rootSessionButton.click();
await waitFor(()=>hostCalls.some(call=>call.type==='open-session'&&call.payload?.sessionId===room.rootSessionId),'root session opens');
assert.ok(document.querySelector('#project-picker .oc-sdk-trigger'),'project picker is mounted');
await waitFor(()=>document.querySelector('#project-picker .oc-sdk-trigger').textContent.includes('Demo 项目'),'project picker follows the host directory');
assert.ok(serviceCalls.some(call=>call.path==='/rooms'&&call.query?.projectDir==='/workspace/demo'),'rooms load for the selected project');
assert.ok(serviceCalls.some(call=>call.path==='/models'&&call.query?.directory==='/workspace/demo'),'models load for the selected project');
assert.equal(document.querySelectorAll('#timeline .message').length,1);
assert.ok(document.querySelector('#composer-text'));
document.querySelector('[data-action="more-questions"]').click();
await waitFor(()=>document.querySelector('#question-list').textContent.includes('第二个问题'),'second question page');
room.rootCreationStatus='failed';room.rootCreationError='模拟根会话失败';
await new Promise(resolve=>setTimeout(resolve,1900));
assert.ok(document.querySelector('#question-list').textContent.includes('第二个问题'),'polling must preserve appended questions');
document.querySelector('.question-item[data-question="q_2"]').click();
await waitFor(()=>document.querySelector('[data-action="withdraw-question"][data-question="q_2"]'),'withdraw action');
document.querySelector('[data-action="withdraw-question"][data-question="q_2"]').click();
await waitFor(()=>document.querySelector('#modal').hasAttribute('open')&&document.querySelector('#withdraw-note'),'withdraw confirmation modal');
assert.equal(serviceCalls.some(call=>call.path.includes('/withdraw')),false,'opening withdraw confirmation does not submit');
document.querySelector('#modal-content [data-action="close-modal"]').click();
assert.equal(serviceCalls.some(call=>call.path.includes('/withdraw')),false,'cancelling withdraw does not submit');
document.querySelector('[data-action="withdraw-question"][data-question="q_2"]').click();
await waitFor(()=>document.querySelector('#withdraw-note'),'withdraw confirmation reopens');
document.querySelector('#withdraw-note').value='与已有问题重复';
document.querySelector('#modal-content [data-action="submit-withdraw"]').click();
const withdrawPath='/rooms/'+room.roomId+'/questions/q_2/withdraw';
await waitFor(()=>serviceCalls.some(call=>call.path===withdrawPath&&call.method==='POST'),'question withdrawn');
assert.deepEqual(JSON.parse(serviceCalls.find(call=>call.path===withdrawPath).body),{note:'与已有问题重复'},'withdraw note comes from the in-page form');
await waitFor(()=>!document.querySelector('#modal').hasAttribute('open')&&!document.querySelector('.question-item[data-question="q_2"]'),'withdraw modal closes and question disappears');
document.querySelector('#new-room').click();
await waitFor(()=>!document.querySelector('#create-view').hidden,'create view');
assert.ok(document.querySelector('#create-view .intro').textContent.includes('每个房间创建一个根会话；成员会话显示在根会话下方，也可从成员“会话”按钮打开。建房本身不会调用模型'),'create intro describes nested member sessions');
assert.equal(document.querySelectorAll('.agent-editor').length,2);
assert.equal(document.querySelectorAll('.agent-editor .model-picker .oc-sdk-trigger').length,2,'model pickers use the SDK select');
const firstModel=document.querySelector('.agent-editor .model-picker');
assert.ok(firstModel.textContent.includes('Probe · 模型 A (high)'),'model picker shows provider, model and variant');
chooseSdkOption(firstModel,'模型 B');
assert.ok(firstModel.textContent.includes('模型 B'),'SDK model choice updates the trigger');
const role=document.querySelector('.agent-editor select[data-field="role"]');role.value='proposer';role.dispatchEvent(new window.Event('change',{bubbles:true}));
assert.equal(document.querySelector('.agent-editor input[data-field="displayName"]').value,'提案者');
document.querySelector('[data-action="add-agent"]').click();assert.equal(document.querySelectorAll('.agent-editor').length,3);
document.querySelector('[data-action="cancel-create"]').click();await waitFor(()=>document.querySelector('#room-view').hidden===false,'room restored');
document.querySelector('.question-item').click();await waitFor(()=>document.querySelector('.answer-form'),'answer form');
const answer=document.querySelector('[data-answer-field="answer"]');answer.value='甲';answer.dispatchEvent(new window.Event('input',{bubbles:true}));
document.querySelector('.answer-form').dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));
await waitFor(()=>document.querySelector('.question-list').textContent.includes('当前筛选下没有问题'),'answer submitted');
const composer=document.querySelector('#composer-text');composer.value='UI 发帖';composer.dispatchEvent(new window.Event('input',{bubbles:true}));document.querySelector('#send-button').click();
await waitFor(()=>document.querySelector('#timeline').textContent.includes('UI 发帖'),'post sent');
document.querySelector('[data-action="receipts"]').click();await waitFor(()=>document.querySelector('#modal').hasAttribute('open'),'receipts modal');assert.ok(document.querySelector('#modal-content').textContent.includes('提案者'));
document.querySelector('[data-action="close-modal"]').click();
chooseSdkOption(document.querySelector('#project-picker'),'另一个项目');
await waitFor(()=>document.querySelector('#project-picker .oc-sdk-trigger').textContent.includes('另一个项目'),'project switch');
await waitFor(()=>serviceCalls.some(call=>call.path==='/rooms'&&call.query?.projectDir==='/workspace/other'),'rooms load for switched project');
await waitFor(()=>!document.querySelector('#room-view').hidden && document.querySelector('#room-header').textContent.includes('根会话创建失败：模拟根会话失败'),'failed root session shows its error');
const pauseButton = document.querySelector('[data-action="pause"]');
pauseButton.click();
await waitFor(() => document.querySelector('[data-action="pause"]')?.disabled || document.querySelector('[data-action="resume"]'), 'pause button is disabled or replaced');
await waitFor(() => document.querySelector('#room-header').textContent.includes('1 次唤醒正在提交'), 'paused room reports a submission in flight');
assert.match(document.querySelector('#room-header').textContent, /1 位成员仍在运行/);
room.reminders = [];
members[1].sessionStatus = 'idle';
emitRoomChanged();
await waitFor(() => !document.querySelector('#room-header').textContent.includes('仍在运行'), 'paused room clears completed activity');
room.status='paused';room.pausedReason='provider-quota';
function emitRoomChanged() {
  window.dispatchEvent(new window.MessageEvent('message',{data:{channel:'openchamber.sdk',v:1,type:'service-event',payload:{topic:'room:changed'}},source:window.parent}));
}
emitRoomChanged();
await waitFor(()=>document.querySelector('#room-header').textContent.includes('模型额度或余额不足，自动唤醒已暂停。充值或更换模型后点击继续房间。'),'provider quota hint');
assert.ok([...document.querySelectorAll('#room-header .composer-hint')].some(hint=>hint.classList.contains('provider-quota')&&hint.textContent.includes('模型额度或余额不足')),'provider quota hint is highlighted');
assert.ok(document.querySelector('[data-action="resume"]'),'provider quota still offers the existing resume action');

holdRoomRefresh = true;
emitRoomChanged();
await waitFor(() => heldRoomRequestId, 'background refresh request');
const roomReadCount = () => serviceCalls.filter(call => call.path === `/rooms/${room.roomId}` && call.method === 'GET').length;
const readsBeforeTimeout = roomReadCount();
emitRoomChanged();
await new Promise(resolve => setTimeout(resolve, 1900));
assert.equal(roomReadCount(), readsBeforeTimeout, 'events and polling cannot overlap an in-flight refresh');
holdRoomRefresh = false;
window.dispatchEvent(new window.MessageEvent('message', {
  data: { channel: 'openchamber.sdk', v: 1, type: 'result', id: heldRoomRequestId, ok: false, code: 'HOST_TIMEOUT', error: 'Host did not answer in time.' },
  source: window.parent,
}));
await waitFor(() => !document.querySelector('#refresh-error').hidden, 'temporary refresh failure appears');
emitRoomChanged();
await new Promise(resolve => setTimeout(resolve, 200));
assert.equal(roomReadCount(), readsBeforeTimeout, 'room events respect the backoff');
await new Promise(resolve => setTimeout(resolve, 3600));
emitRoomChanged();
await waitFor(() => document.querySelector('#refresh-error').hidden, 'successful retry clears the refresh notice');
assert.ok(roomReadCount() > readsBeforeTimeout);

document.querySelector('[data-action="end"]').click();
await waitFor(()=>document.querySelector('#modal').hasAttribute('open')&&document.querySelector('[data-action="confirm-end-room"]'),'end confirmation modal');
assert.equal(serviceCalls.some(call=>call.path==='/rooms/'+room.roomId+'/end'),false,'opening end confirmation does not end the room');
document.querySelector('#modal-content [data-action="close-modal"]').click();
assert.equal(serviceCalls.some(call=>call.path==='/rooms/'+room.roomId+'/end'),false,'cancelling end keeps the room active');
document.querySelector('[data-action="end"]').click();
await waitFor(()=>document.querySelector('[data-action="confirm-end-room"]'),'end confirmation reopens');
document.querySelector('[data-action="confirm-end-room"]').click();
await waitFor(()=>serviceCalls.some(call=>call.path==='/rooms/'+room.roomId+'/end'&&call.method==='POST'),'room ended');
await waitFor(()=>room.status==='ended'&&!document.querySelector('[data-action="end"]')&&document.querySelector('#composer-text').disabled,'ended room disables composer');
assert.deepEqual(nativeDialogCalls,[],'sandboxed panel never uses native confirm or prompt');
document.querySelector('#new-room').click();
await waitFor(()=>!document.querySelector('#create-view').hidden,'create view after project switch');
await waitFor(()=>document.querySelector('#model-source-hint').textContent.includes('其他项目'),'global model fallback hint');
assert.ok(serviceCalls.some(call=>call.path==='/models'&&call.query?.directory==='/workspace/other'),'models reload for switched project');
assert.deepEqual(errors,[]);
console.log('PASS panel DOM smoke: project picker, SDK model picker, member model change, failure pills, provider quota hint, create form, role defaults, question answer, withdraw/end dialogs, composer, receipts modal, global fallback');
 window.close();
 store.close();
rmSync(panelRoot,{recursive:true,force:true});
