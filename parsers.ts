import { ServerRequest } from "https://deno.land/std/http/server.ts";
import { ParserOptions } from "./metadata.ts";

async function getRaw(req: ServerRequest) {
    try {
        return await Deno.readAll(req.body);
    } catch(err) {}
    return;
}

function getText(body: Uint8Array) {
    return new TextDecoder().decode(body);
}

export const Parsers: Record<string, Function> = {

    BINARY: async function(req: ServerRequest, options: ParserOptions) {
        const decoded=await getRaw(req);
        return {decoded, raw: decoded};
    },

    TEXT: async function(req: ServerRequest, options: ParserOptions) {
        const raw=await getRaw(req);
        if(!raw)
            return;
        const decoded=getText(raw);
        return {decoded, raw};
    },

    JSON: async function(req: ServerRequest, options: ParserOptions) {
        const raw=await getRaw(req);
        if(!raw)
            return;
        const decoded=JSON.parse(getText(raw));
        return {decoded, raw};
    },

    URL_ENCODED: async function(req: ServerRequest, options: ParserOptions) {
        const raw=await getRaw(req);
        if(!raw)
            return;
        const urlParams=new URLSearchParams(getText(raw));
        const decoded:any={};
        for(const [k, v] of urlParams.entries()) {
            if(v && !isNaN(Number(v)))
                decoded[k]=+v;
            else if(v==="true")
                decoded[k]=true;
            else if(v==="false")
                decoded[k]=false
            else
                decoded[k]=v;
        }
        return {decoded, raw};
    },

    MFD: async function(req: ServerRequest, options: ParserOptions) {
        
    },

    UNKNOWN: async function(req: ServerRequest, options: ParserOptions) {
        if(options.unknownAsText === true)
            return await Parsers.TEXT(req, options);
        return await Parsers.BINARY(req, options);
    }
};