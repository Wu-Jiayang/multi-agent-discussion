import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { JSDOM, VirtualConsole } from 'jsdom';
import { RoomStore } from '../src/core/room-store.mjs';

const repo=fileURLToPath(new URL('../',import.meta.url));
const html=readFileSync(repo+'/panel/index.html','utf8').replace('<script src="main.js"></script>','<script>'+readFileSync(repo+'/panel/main.js','utf8')+'</script>');
const tokens={background:'#111',elevated:'#191919',foreground:'#eee',muted:'#999',subtle:'#777',border:'#333',hover:'#222',selection:'#345',focus:'#79f',primary:'#eee',mutedSurface:'#222',elevatedForeground:'#fff',active:'#345',selectionForeground:'#fff',primaryForeground:'#111',primaryText:'#eee',successText:'#6f6',warningText:'#fa6',errorText:'#f66',infoText:'#6af',success:'#262',warning:'#640',error:'#800',info:'#068',font:'sans-serif',mono:'monospace',radius:'8px',fontSize:'14px'};
const errors=[];
const virtualConsole=new VirtualConsole();virtualConsole.on('jsdomError',e=>errors.push(e.message));virtualConsole.on('error',e=>errors.push(String(e)));
let dom;
const panelRoot=mkdtempSync('/tmp/opencode/room-panel-');
const store=new RoomStore();
const created=store.createRoom({projectDir:panelRoot,tempRoot:panelRoot,title:'测试讨论',members:[{role:'proposer',displayName:'提案者',model:{providerID:'probe',id:'a'}},{role:'reviewer',displayName:'审查者',model:{providerID:'probe',id:'b'}}]});
store.db.prepare("UPDATE members SET creation_status='ready' WHERE room_id=? AND kind='agent'").run(created.roomId);
store.db.prepare("UPDATE rooms SET status='ready' WHERE id=?").run(created.roomId);
store.post(created.roomId,{kind:'human',memberId:created.human.memberId},{text:'第一条消息'});
const room=store.roomSummary(store.room(created.roomId));
room.members=room.members.map((member,index)=>({...member,sessionId:'ses_'+member.memberId,sessionStatus:index?'running':'idle'}));
const members=room.members;
let messages=store.history(room.roomId,{viewerMemberId:room.human.memberId,trackPresentation:false}).items;
let questions=[{questionId:'q_1',messageId:'m_question_1',roomSeq:2,asker:members[1],createdAt:new Date().toISOString(),status:'pending',text:'选择哪种方案？',options:['甲','乙'],preview:true},{questionId:'q_2',messageId:'m_question_2',roomSeq:3,asker:members[0],createdAt:new Date().toISOString(),status:'pending',text:'第二个问题',options:[],preview:true}];
function response(m,payload={}){dom.window.dispatchEvent(new dom.window.MessageEvent('message',{data:{channel:'openchamber.sdk',v:1,type:'result',id:m.id,ok:true,payload},source:dom.window.parent}));}
dom=new JSDOM(html,{runScripts:'dangerously',url:'http://local/panel/index.html',virtualConsole,beforeParse(window){
  const NativeMessageEvent = window.MessageEvent;
  window.MessageEvent = class extends NativeMessageEvent {
    constructor(type, init = {}) { super(type, init); Object.defineProperty(this, 'source', { value: init.source ?? window.parent }); }
  };
  const parent = {};
  parent.postMessage = message => {
    queueMicrotask(()=>{
      if(message.type==='hello'){window.dispatchEvent(new window.MessageEvent('message',{data:{channel:'openchamber.sdk',v:1,type:'ready',payload:{theme:{mode:'dark',tokens},locale:'zh-CN',directory:'/workspace/demo',session:null,surface:'page',item:null,connection:null,settings:{},device:{formFactor:'desktop',pointer:'fine',insets:{top:0,right:0,bottom:0,left:0},keyboard:0}}},source:window.parent}));return}
      if(message.type==='storage'){const op=message.payload.op;response({id:message.id},{op,storage:op==='get'?{op:'get',found:false}:{op}});return}
      if(message.type==='service-request'){
        const p=message.payload;let data={};
        if(p.path==='/meta')data={humanName:'房主'};
        else if(p.path.startsWith('/models'))data={models:[{providerID:'probe',id:'a',name:'模型 A',variant:'high'},{providerID:'probe',id:'b',name:'模型 B'}]};
        else if(p.path==='/rooms')data={rooms:[room]};
        else if(p.path==='/rooms/'+room.roomId+'')data=room;
        else if(p.path==='/rooms/'+room.roomId+'/timeline')data={items:messages,previousCursor:null,nextCursor:null};
        else if(p.path.includes('/context'))data={items:messages};
        else if(p.path==='/rooms/'+room.roomId+'/questions')data=p.query?.cursor?{items:questions.slice(1),status:'pending',nextCursor:null}:{items:questions.slice(0,1),status:'pending',nextCursor:'next-page'};
        else if(p.path==='/rooms/'+room.roomId+'/mentions')data={items:[...members.map(m=>({id:m.memberId,label:m.displayName,kind:'agent'})),{id:'@all',label:'所有人',kind:'all'}]};
        else if(p.path==='/rooms/'+room.roomId+'/messages'&&p.method==='POST'){const input=JSON.parse(p.body);const seq=room.latestSeq+1;const message={messageId:'m_new_'+seq,roomSeq:seq,author:room.human,isOwn:true,kind:'post',createdAt:new Date().toISOString(),mentions:[],mentionAll:false,replyToMessageId:input.replyToMessageId||null,questionId:null,questionStatus:null,answerMessageId:null,label:'[#'+seq+' 房主 · 人类 · 你]',text:input.text,options:[],full:true,preview:false};messages.push(message);room.latestSeq=seq;data={status:'stored',messageId:message.messageId,roomSeq:seq,timeline:messages.slice(-8)}}
        else if(p.path.includes('/answer')){questions=[];room.pendingQuestions=0;data={status:'answered',answerMessageId:'m_answer',messageId:'m_answer',roomSeq:3}}
        else if(p.path.includes('/receipts'))data={messageId:'m_1',human:null,agents:[{memberId:'m_a',displayName:'提案者',kind:'agent',readAt:new Date().toISOString(),source:'model-context'}]};
        else if(p.path==='/rooms/'+room.roomId+'/read')data={marked:1,unread:{unreadCount:0,unreadMentionCount:0,unreadMentions:[]}};
        else if(p.path==='/workspace/read')data={path:'/tmp/opencode/Discussions/r_demo/a.md',content:'# 文档'};
        response({id:message.id},{status:200,body:JSON.stringify(data)});return}
      response({id:message.id},{ok:true});
    });
  };
  Object.defineProperty(window,'parent',{configurable:true,value:parent});
  window.IntersectionObserver=class{observe(){}disconnect(){}};
  window.CSS={escape:value=>String(value).replace(/["\\]/g,'\\$&')};
  window.HTMLElement.prototype.scrollIntoView=function(){};
  window.HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','')};
  window.HTMLDialogElement.prototype.close=function(){this.removeAttribute('open')};
  window.confirm=()=>true;window.prompt=()=> '';
}});
const window=dom.window;const document=window.document;
async function waitFor(fn,label){for(let i=0;i<100;i++){if(fn())return;await new Promise(r=>setTimeout(r,20));}throw new Error('Timeout '+label+'; errors='+errors.join('\n')+'; questions='+document.querySelector('#question-list')?.textContent+'; error='+document.querySelector('#error')?.textContent)}
await waitFor(()=>document.querySelector('#room-header').textContent.includes('测试讨论'),'room header');
assert.equal(document.querySelectorAll('#timeline .message').length,1);
assert.ok(document.querySelector('#composer-text'));
document.querySelector('[data-action="more-questions"]').click();
await waitFor(()=>document.querySelector('#question-list').textContent.includes('第二个问题'),'second question page');
await new Promise(resolve=>setTimeout(resolve,1900));
assert.ok(document.querySelector('#question-list').textContent.includes('第二个问题'),'polling must preserve appended questions');
document.querySelector('#new-room').click();
await waitFor(()=>!document.querySelector('#create-view').hidden,'create view');
assert.equal(document.querySelectorAll('.agent-editor').length,2);
assert.ok([...document.querySelector('.agent-editor select[data-field="model"]').options].some(option=>option.value===JSON.stringify(['probe','a','high'])));
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
assert.deepEqual(errors,[]);
console.log('PASS panel DOM smoke: create form, role defaults, question answer, composer, receipts modal');
window.close();
store.close();
rmSync(panelRoot,{recursive:true,force:true});
