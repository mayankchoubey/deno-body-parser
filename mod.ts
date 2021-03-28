'use strict';

import { ParserOptions, 
         PARSER_ERRORS,
         HTTP_Header,
         ResponseTypes,
         SupportedContentTypeMetadata,
         ContentMeta,
         PARSER_TYPES
        } from "./metadata.ts";
import { Parsers } from "./parsers.ts";
import { ServerRequest } from "https://deno.land/std/http/server.ts";

function raiseException(message: string) {
    let errMessage='DenoBodyParser: caught error ';
    if(message)
        errMessage+=message;
    throw new Error(errMessage);
}

function checkHeaders(headers: Headers): string {
    if(!headers)
        return PARSER_ERRORS.CONTENT_LENGTH_MISSING_OR_ZERO;

    const cl=headers.get(HTTP_Header.HDR_CONTENT_LENGTH);
    if(!cl)
        return PARSER_ERRORS.CONTENT_LENGTH_MISSING_OR_ZERO;
    let cln: number;
    try {
        cln=parseInt(cl);
    } catch(err) {
        cln=0;
    }
    if(cln === 0)
        return PARSER_ERRORS.CONTENT_LENGTH_MISSING_OR_ZERO;
    
    const ct=headers.get(HTTP_Header.HDR_CONTENT_TYPE);
    if(!ct)
        return PARSER_ERRORS.CONTENT_TYPE_MISSING_OR_EMPTY;
    return PARSER_ERRORS.NONE;
}

function checkRequest(req: ServerRequest): string {
    if(!req)
        return PARSER_ERRORS.REQUEST_NULL;
    const hdrCheckErr=checkHeaders(req.headers);
    if(hdrCheckErr)
        return hdrCheckErr;
    return PARSER_ERRORS.NONE;
}

function getContentMeta(headers: Headers): ContentMeta {
    const ct=headers.get(HTTP_Header.HDR_CONTENT_TYPE)?.split(";")[0];
    let meta=SupportedContentTypeMetadata['UNKNOWN'];
    for(const [k, v] of Object.entries(SupportedContentTypeMetadata)) {
        if(v.ct === ct)
            meta=v;
    }
    return meta;
}

function getParseOptions(options: ParserOptions): ParserOptions {
    const ret: ParserOptions={};
    ret.unknownAsText=options.unknownAsText === true ? true: false;
    ret.saveBodyToFile=options.saveBodyToFile === true ? true: false;
    ret.saveFilePath=options.saveFilePath ? options.saveFilePath : './';
    if(!ret.saveFilePath.endsWith('/'))
        ret.saveFilePath+='/';
    return ret;
}

function encodeRes(body: any) {
    const encoder=new TextEncoder();
    if(body.constructor === Uint8Array)
        return body;
    else if(typeof body === 'string')
        return encoder.encode(body);
    else if(typeof body === 'object')
        return encoder.encode(JSON.stringify(body));
    return body;
}

async function prepareResponse(ctMeta: ContentMeta, decodedObj: any, options: ParserOptions) {
    if(!decodedObj.decoded)
        return;
    let respType=ctMeta.resp;
    if(ctMeta.parser === PARSER_TYPES.UNKNOWN && options.unknownAsText === true)
        respType=SupportedContentTypeMetadata[PARSER_TYPES.TEXT].resp;
    if(options.saveBodyToFile === false)
        return {[respType]: decodedObj.decoded};
    const path=options.saveFilePath+Math.random().toString(36).slice(2)+'.'+ctMeta.ext;
    await Deno.writeFile(path, decodedObj.raw);
    return { [ResponseTypes.RESP_TYPE_FILE]: [ { path,
                                                 type: ctMeta.ct,
                                                 size: decodedObj.raw.length }]};
}

export async function parse(req: ServerRequest, 
                            options: ParserOptions = {}): Promise<any> {
    const err:string=checkRequest(req);
    if(err)
        return raiseException(err);
    const parseOptions:ParserOptions=getParseOptions(options);
    const ctMeta:ContentMeta=getContentMeta(req.headers);
    const decodedObj=await Parsers[ctMeta.parser](req, parseOptions);
    return await prepareResponse(ctMeta, decodedObj, parseOptions);
}

