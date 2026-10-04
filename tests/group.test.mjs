import test from 'node:test';
import assert from 'node:assert/strict';
import {memberName,memberCookie,readMember,moveKey,mergeGroup} from '../lib/group.mjs';
const id='12345678-1234-1234-1234-123456789abc';
test('member identity cookies reject edits and changed group secrets',()=>{
 const cookie=memberCookie(id,'test-group-secret');assert.equal(readMember(cookie,'test-group-secret'),id);
 assert.equal(readMember(cookie.replace(id,'abcdefab-1234-1234-1234-123456789abc'),'test-group-secret'),null);
 assert.equal(readMember(cookie,'other-group-secret'),null);assert.equal(readMember('wtm_member='+id+'.'+'é'.repeat(64),'test-group-secret'),null);
});
test('names are bounded, normalized and cannot contain markup',()=>{
 assert.equal(memberName('  Aiden   Ko  '),'Aiden Ko');for(const s of ['',null,'<script>','a'.repeat(41)])assert.throws(()=>memberName(s));
});
test('group saves survive importer ID changes and attendees identify only the current member',()=>{
 const e={id:'new-id',url:'https://luma.com/example',start:'2026-10-06T00:30:00Z'};const key=moveKey(e);
 assert.equal(key,moveKey({...e,id:'old-id',start:'2026-10-05T17:30:00-07:00'}));
 const [event]=mergeGroup([e],[{event_key:key}],[{event_key:key,member_id:'alice',name:'Alice'},{event_key:key,member_id:'bob',name:'Bob'}],'bob');
 assert.equal(event.groupSaved,true);assert.deepEqual(event.going,[{name:'Alice',me:false},{name:'Bob',me:true}]);
 assert.equal(mergeGroup([e],[],[{event_key:key,member_id:'alice',name:'Alice'}],'alice')[0].going.length,0);
});
