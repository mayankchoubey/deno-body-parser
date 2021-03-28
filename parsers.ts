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

    MFD: async function(req: ServerRequest, options: ParserOptions) {
        
    },

    UNKNOWN: async function(req: ServerRequest, options: ParserOptions) {
        if(options.unknownAsText === true)
            return await Parsers.TEXT(req, options);
        return await Parsers.BINARY(req, options);
    }
};