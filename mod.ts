'use strict';

import { ParserOptions, 
         PARSER_ERRORS,
         HTTP_Header,
         ResponseTypes,
         SupportedContentTypeMetadata,
         ContentMeta,
         PARSER_TYPES,
         INTERNAL_MFD_FILE_KEY
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
    ret.xmlToJson=options.xmlToJson === false? false: true;
    ret.unknownAsText=options.unknownAsText === true ? true: false;
    ret.saveBodyToFile=options.saveBodyToFile === true ? true: false;
    ret.saveFilePath=options.saveFilePath ? options.saveFilePath : './';
    if(!ret.saveFilePath.endsWith('/'))
        ret.saveFilePath=`${ret.saveFilePath}/`;
    return ret;
}

function getRandomFileName(ext:string) {
    return Math.random().toString(36).slice(2)+'.'+ext;
}

function getFileName(url:string, ext:string) {
    const randomFileName:string=getRandomFileName(ext);
    if(!url)
        return randomFileName;
    const qs=url.split("?")[1] || undefined;
    if(!qs)
        return randomFileName;
    const qsObj=new URLSearchParams(qs);
    return qsObj.get("filename") || qsObj.get("fileName") || randomFileName;
}

async function saveIntoFile(ctMeta: ContentMeta, raw:Uint8Array, url:string, path:string='./') {
    const ret:any={};
    ret.name=getFileName(url, ctMeta.ext);
    ret.path=(await Deno.realPath(path))+'/'+ret.name;
    await Deno.writeFile(ret.path, raw);
    ret.type=ctMeta.ct;
    ret.size=raw.length;
    return ret;
}

async function updateMFDFilePaths(data:any, options: ParserOptions) {
    for(const k in data.files) {
        const file=data.files[k];
        if(!file.path)
            continue;
        const ext:string=file.name.split(".")[1] || "unknown";
        const newPath=(await Deno.realPath(options.saveFilePath||"./"))+'/'+getRandomFileName(ext);
        await Deno.rename(file.path, newPath);
        file.path=newPath;
    }
}

async function prepareResponse(url:string, ctMeta: ContentMeta, decodedObj: any, options: ParserOptions) {
    if(!decodedObj || !decodedObj.decoded || !decodedObj.raw)
        return;
    let respType=ctMeta.resp;
    if((ctMeta.parser === PARSER_TYPES.UNKNOWN && options.unknownAsText === true) ||
        (ctMeta.parser === PARSER_TYPES.XML && options.xmlToJson === false))
        respType=SupportedContentTypeMetadata[PARSER_TYPES.TEXT].resp;
    const ret={[respType]: decodedObj.decoded};
    if(decodedObj.decoded[INTERNAL_MFD_FILE_KEY]) {
        ret[ResponseTypes.RESP_TYPE_FILE]=decodedObj.decoded[INTERNAL_MFD_FILE_KEY];
        delete decodedObj.decoded[INTERNAL_MFD_FILE_KEY];
        await updateMFDFilePaths(ret, options);
    }
    if(options.saveBodyToFile === false)
        return ret;
    const fileData=await saveIntoFile(ctMeta, decodedObj.raw, url, options.saveFilePath);
    return { [ResponseTypes.RESP_TYPE_FILE]: { "uploadedFile": fileData}};
}

export async function parse(req: ServerRequest, 
                            options: ParserOptions = {}): Promise<any> {
    const err:string=checkRequest(req);
    if(err)
        return raiseException(err);
    const parseOptions:ParserOptions=getParseOptions(options);
    const ctMeta:ContentMeta=getContentMeta(req.headers);
    const decodedObj=await Parsers[ctMeta.parser](req, parseOptions);
    return await prepareResponse(req.url, ctMeta, decodedObj, parseOptions);
}

