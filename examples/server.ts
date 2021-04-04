import { parse } from "https://raw.githubusercontent.com/mayankchoubey/deno-body-parser/main/mod.ts";
import { serve } from "https://deno.land/std/http/server.ts";

const dataStorePath='/private/var/tmp/uploads';
const encoder=new TextEncoder();
const server = serve({ hostname: "0.0.0.0", port: 8080 });
for await (const request of server) {
    switch(request.url) {
        case '/uploads': {
            const body=await parse(request, {saveBodyToFile: true, saveFilePath: dataStorePath});
            if(!body || !body.files) {
                request.respond({status: 400});
                break;
            }
            console.log(body);
            const retData=encoder.encode(JSON.stringify({uploadedSize: body.files.uploadedFile.size}));
            request.respond({status: 201, body: retData});
            break;
        }

        case '/add': {
            const body=await parse(request);
            if(!body || !body.data) {
                request.respond({status: 400});
                break;
            }
            const id=body.data.id, key=body.data.prop.key, val=body.data.prop.val;
            //add kv to product somewhere
            console.log(body, id, key, val);
            request.respond({status: 204});
            break;
        }

        case '/submit': {
            const body=await parse(request);
            if(!(body && body.data)) {
                request.respond({status: 400});
                break;
            }
            const meta=body.data;
            const selfie=body.files?.selfie, dl=body.files?.dl;
            //do something with data and files
            console.log(meta, selfie, dl);
            const retData=encoder.encode(JSON.stringify({uploadedSize: {selfie: selfie?.size, dl: dl?.size}}));
            request.respond({status: 201, body: retData});
            break;
        }

        default: {
            request.respond({status: 404});
        }
    }
}

