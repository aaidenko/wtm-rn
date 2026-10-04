import {waitUntil} from '@vercel/functions';
import {database} from './index.mjs';
import {verifyPhoton,incomingMessage,digest} from '../lib/agent.mjs';
import {senderKey,processJob} from '../lib/agent-service.mjs';
export const config={api:{bodyParser:false}};
export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='POST')return res.status(405).json({error:'Use POST.'});
  if(!process.env.SPECTRUM_WEBHOOK_SECRET||!process.env.SPECTRUM_PROJECT_ID||!process.env.SPECTRUM_PROJECT_SECRET||!process.env.DATABASE_URL)return res.status(503).json({error:'Photon is not connected yet.'});
  try{
    const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>65536)return res.status(413).end();chunks.push(chunk);}
    const raw=Buffer.concat(chunks);if(!verifyPhoton(raw,req.headers,process.env.SPECTRUM_WEBHOOK_SECRET))return res.status(401).json({error:'Invalid signature.'});
    let payload;try{payload=JSON.parse(raw.toString('utf8'));}catch{return res.status(400).end();}
    const message=incomingMessage(payload);if(!message)return res.status(200).json({ignored:true});
    const sql=await database(),key=senderKey(message.sender);
    // Unlinked senders may only connect an identity; don't spend AI tokens on strangers.
    const [linked]=await sql`SELECT member_id FROM agent_links WHERE sender_key=${key}`;
    if(!linked){
      const match=message.text.match(/^link\s+([a-f0-9]{12})$/i);if(!match)return res.status(200).json({ignored:true});
      const [pair]=await sql`SELECT member_id FROM agent_pairings WHERE code_hash=${digest(match[1].toUpperCase())} AND expires_at>NOW()`;if(!pair)return res.status(200).json({ignored:true});
    }
    const inserted=await sql`INSERT INTO agent_jobs(id,sender_key,payload) VALUES(${message.id},${key},${JSON.stringify(message)}) ON CONFLICT DO NOTHING RETURNING id`;
    if(inserted.length)waitUntil(processJob(message.id));
    else{const [job]=await sql`SELECT status FROM agent_jobs WHERE id=${message.id}`;if(job?.status==='failed')waitUntil(processJob(message.id));}
    return res.status(202).json({ok:true});
  }catch{return res.status(503).json({error:'Please retry.'});}
}
