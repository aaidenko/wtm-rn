import {mkdir,readdir,copyFile,rm} from 'node:fs/promises';
await rm('dist',{recursive:true,force:true});
await mkdir('dist',{recursive:true});
for(const name of await readdir('public')) if(name!=='preview-data.json') await copyFile(`public/${name}`,`dist/${name}`);
console.log('WTM static site built. Preview data excluded.');
