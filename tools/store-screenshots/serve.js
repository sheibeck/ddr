// tiny static server for www/ (ES modules need http://)
const http=require('http'),fs=require('fs'),path=require('path');
const root=require('path').resolve(__dirname,'../../www');
const types={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2','.woff':'font/woff','.ttf':'font/ttf','.jpg':'image/jpeg','.webp':'image/webp'};
http.createServer((req,res)=>{
  let p=decodeURIComponent(req.url.split('?')[0]); if(p==='/')p='/index.html';
  const f=path.join(root,p);
  fs.readFile(f,(e,d)=>{ if(e){res.writeHead(404);return res.end('nf');}
    res.writeHead(200,{'content-type':types[path.extname(f)]||'application/octet-stream'}); res.end(d);});
}).listen(8765,()=>console.log('serving on 8765'));
