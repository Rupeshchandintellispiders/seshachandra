import vinext from 'vinext';
import {defineConfig} from 'vite';
import {sites} from './scripts/vite/sites-vite-plugin';
export default defineConfig({plugins:[vinext(),sites({mockAuth:true})],ssr:{external:['mysql2','mysql2/promise']},environments:{rsc:{resolve:{external:['mysql2','mysql2/promise']}}},server:{host:'127.0.0.1'}});
