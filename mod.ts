'use strict';

import { ServerRequest } from "https://deno.land/std/http/server.ts";

export interface DenoBodyParserOptions {
    unknownAsText?: boolean,
    saveBodyToFile?: boolean
};

enum PARSER_ERROR {
    REQUEST_NULL="Request object is null",
    REQUEST_EMPTY="Request object is empty",
    CONTENT_LENGTH_MISSING_OR_ZERO="Content length is 0 or missing",
    CONTENT_TYPE_MISSING_OR_EMPTY="Content type is missing or empty",
    NONE=""
};

enum HTTPHeader {
    HDR_CONTENT_LENGTH='content-length',
    HDR_CONTENT_TYPE='content-type'
};

const SupportedContentType={
    TEXT: 'text/plain',
    HTML: 'text/html',
    JSON: 'application/json',
    MFD: 'multipart/form-data',
    AUDIO_AAC: 'audio/aac',
    OCTET_STREAM: 'application/octet-stream',
    UNKNOWN: 'x-unknown-content-type'
};

function raiseException(message: string) {
    let errMessage='DenoBodyParser: caught error ';
    if(message)
        errMessage+=message;
    throw new Error(errMessage);
}

function checkHeaders(headers: Headers): string {
    if(!headers)
        return PARSER_ERROR.CONTENT_LENGTH_MISSING_OR_ZERO;

    const cl=headers.get(HTTPHeader.HDR_CONTENT_LENGTH);
    if(!cl)
        return PARSER_ERROR.CONTENT_LENGTH_MISSING_OR_ZERO;
    let cln: number;
    try {
        cln=parseInt(cl);
    } catch(err) {
        cln=0;
    }
    if(cln === 0)
        return PARSER_ERROR.CONTENT_LENGTH_MISSING_OR_ZERO;
    
    const ct=headers.get(HTTPHeader.HDR_CONTENT_TYPE);
    if(!ct)
        return PARSER_ERROR.CONTENT_TYPE_MISSING_OR_EMPTY;
    return PARSER_ERROR.NONE;
}

function checkRequest(req: ServerRequest): string {
    if(!req)
        return PARSER_ERROR.REQUEST_NULL;
    const hdrCheckErr=checkHeaders(req.headers);
    if(hdrCheckErr)
        return hdrCheckErr;
    return PARSER_ERROR.NONE;
}

function getContentType(headers: Headers): string {
    const ct=headers.get(HTTPHeader.HDR_CONTENT_TYPE)?.split(";")[0];
    for(const [k, v] of Object.entries(SupportedContentType)) {
        if(v === ct)
            return k;
    }
    return 'UNKNOWN';
}

async function getRawBody(req: ServerRequest): Promise<Uint8Array | undefined> {
    try {
        return await Deno.readAll(req.body);
    } catch(err) {}
    return;
}

function getParseOptions(options: DenoBodyParserOptions) {
    const ret: DenoBodyParserOptions={};
    if(options.unknownAsText === true)
        ret.unknownAsText=true;
    else
        ret.unknownAsText=false;
    if(options.saveBodyToFile === true)
        ret.saveBodyToFile=true;
    else
        ret.saveBodyToFile=false;
    return ret;
}

function encodeRes(res: any) {
    const encoder=new TextEncoder();
    if(res.constructor === Uint8Array)
        return res;
    else if(typeof res === 'string')
        return encoder.encode(res);
    else if(typeof res === 'object')
        return encoder.encode(JSON.stringify(res));
    return res;   
}

async function respond(res: any, options: DenoBodyParserOptions) {
    if(options.saveBodyToFile === false)
        return res;
    const filepath = await Deno.makeTempFile({dir: "."});
    await Deno.writeFile(filepath, encodeRes(res));
    return filepath;
}

const Parsers: Record<string, Function> = {
    UNKNOWN: async function(body: Uint8Array, options: DenoBodyParserOptions) {
        let ret: Uint8Array|string=body;
        if(options.unknownAsText === true)
            ret=new TextDecoder().decode(body);
        return await respond(ret, options);
    },

    TEXT: async function(body: Uint8Array, options: DenoBodyParserOptions) {
        return await respond(new TextDecoder().decode(body), options);
    },

    AUDIO_AAC: async function(body: Uint8Array, options: DenoBodyParserOptions) {
        return await respond(body, options);
    },

    OCTET_STREAM: async function(body: Uint8Array, options: DenoBodyParserOptions) {
        return await respond(body, options);
    }
};

export async function parse(req: ServerRequest, 
                            options: DenoBodyParserOptions = {}): Promise<string | any> {
    const validationErr=checkRequest(req);
    if(validationErr)
        return raiseException(validationErr);
    const ct=getContentType(req.headers);
    const rb=await getRawBody(req);
    if(!rb)
        return;
    return await Parsers[ct](rb, getParseOptions(options));
}

