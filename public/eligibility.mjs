export function studentAccess(text,{publicRegistration=false,audiences=[]}={}){
  if(/(?:invite|invitation)[ -]only|(?:members|alumni|faculty|staff|investors|VCs|founders|executives|employees)\s+only|only\s+(?:for|open to)\s+(?:alumni|faculty|staff|investors|founders|executives)|(?:must|need to)\s+be\s+(?:a\s+)?(?:founder|investor|member)|ages?\s*(?:21\+|21 and (?:over|older))/i.test(text))return {accessible:false,access:'Restricted audience'};
  if(/(?:currently enrolled|stanford)\s+(?:university\s+)?students|stanford community/i.test(text))return {accessible:true,access:'Stanford students'};
  if(audiences.some(a=>/^(everyone|general public|students|undergraduate students|graduate students|stanford community)$/i.test(a)))return {accessible:true,access:'Open to students'};
  if(audiences.length)return {accessible:false,access:'Audience not confirmed for students'};
  if(publicRegistration||/open to (?:everyone|all|the public)|all (?:are )?welcome|anyone .*welcome/i.test(text))return {accessible:true,access:'Public registration'};
  return {accessible:false,access:'Student access not confirmed'};
}
export function admission(text,price='',flag=false){
  // Free snacks and an empty price field do not establish free admission.
  const listed=String(price).trim();
  if(/[$€£]\s*[1-9]|\b(?:USD|EUR|GBP)\s*[1-9]|\b[1-9]\d*(?:\.\d+)?\s*(?:dollars|USD|EUR|GBP)/i.test(listed))return {free:false,freeEvidence:''};
  if(flag===true)return {free:true,freeEvidence:'Organizer marks admission free'};
  if(/^(?:free|\$0(?:\.00)?|0|no charge|complimentary)(?:\s+(?:entry|admission|registration))?[.!]?$/i.test(listed))return {free:true,freeEvidence:'Organizer lists free admission'};
  const proof=text.match(/\b(?:free (?:admission|entry|registration|event)|(?:admission|entry|registration|event) (?:is |will be )?free|free and open to (?:the public|all|everyone)|no (?:admission|registration) (?:fee|charge)|(?:event|admission) is complimentary)\b/i);
  return {free:!!proof,freeEvidence:proof?`Organizer: ${proof[0]}`:''};
}
