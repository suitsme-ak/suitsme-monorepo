import {build} from 'esbuild';
await build({entryPoints:['studio/index.js'],bundle:true,minify:true,format:'esm',target:'es2022',outfile:'public/studio.bundle.js',legalComments:'eof'});
console.log('3D studio bundled');
