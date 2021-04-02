'use strict';

import { ParserOptions, 
         PARSER_ERRORS,
         HTTP_Header,
         ResponseTypes,
         SupportedContentTypeMetadata,
         ContentMeta,
         PARSER_TYPES,
         INTERNAL_MFD_FILE_KEY,
         FileData
        } from "./metadata.ts";
import { Parsers } from "./parsers.ts";
import { ServerRequest } from "https://deno.land/std/http/server.ts";

const   KEY_UPLOADED_FILE='uploadedFile',
        KEY_FILE_NAME_LC='filename',
        KEY_FILE_NAME_CC='fileName',
        KEY_UNKNOWN_LC='unknown',
        KEY_UNKNOWN_UC='UNKNOWN';

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
    let meta=SupportedContentTypeMetadata[KEY_UNKNOWN_UC];
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

function getRandomAlphaNumeric():string {
    return Math.random().toString(36).slice(2);
}

function getRandomFileName(ext:string) {
    return getRandomAlphaNumeric()+'.'+ext;
}

function getFileName(url:string, ext:string) {
    const randomFileName:string=getRandomFileName(ext);
    if(!url)
        return randomFileName;
    const qs=url.split("?")[1] || undefined;
    if(!qs)
        return randomFileName;
    const qsObj=new URLSearchParams(qs);
    return qsObj.get(KEY_FILE_NAME_LC) || qsObj.get(KEY_FILE_NAME_CC) || randomFileName;
}

async function saveIntoFile(ctMeta: ContentMeta, 
                            raw:Uint8Array, 
                            url:string, 
                            path:string='./',
                            fileName?: string):Promise<FileData> {
    const ret:FileData={
        name: fileName || getFileName(url, ctMeta.ext),
        size: raw.length,
        type: ctMeta.ct
    };
    ret.path=(await Deno.realPath(path))+'/'+ret.name;
    await Deno.writeFile(ret.path, raw);
    return ret;
}

async function postProcessMFD(data:any, options: ParserOptions) {
    for(const k in data.files) {
        const file=data.files[k];
        if(!file.path && options.saveBodyToFile === false)
            continue;
        else if(!file.path && options.saveBodyToFile === true) {
            const ext=file.name.split(".")[1] || KEY_UNKNOWN_LC;
            const fileData=await saveIntoFile({ext} as ContentMeta, file.content, '', options.saveFilePath, file.name);
            file.path=fileData.path;
            delete file.content;
        } else {
            const ext:string=file.name.split(".")[1] || KEY_UNKNOWN_LC;
            const newPath=(await Deno.realPath(options.saveFilePath||"./"))+'/'+getRandomFileName(ext);
            await Deno.rename(file.path, newPath);
            file.path=newPath;
        }
    }
    if(options.saveBodyToFile === false)
        return; 
    const rawData=new TextEncoder().encode(JSON.stringify(data.data));
    const jsonFileData:FileData=await saveIntoFile(SupportedContentTypeMetadata[PARSER_TYPES.JSON], rawData, '', options.saveFilePath);
    if(!data.files)
        data.files={};
    if(!data.files[KEY_UPLOADED_FILE])
        data.files[KEY_UPLOADED_FILE]=jsonFileData;
    else
        data.files[KEY_UPLOADED_FILE+getRandomAlphaNumeric()]=jsonFileData;
    delete data.data;
}

async function prepareResponse(url:string, ctMeta: ContentMeta, decodedObj: any, options: ParserOptions) {
    if(!decodedObj || !decodedObj.decoded || !decodedObj.raw)
        return;
    let respType=ctMeta.resp;
    if((ctMeta.parser === PARSER_TYPES.UNKNOWN && options.unknownAsText === true) ||
        (ctMeta.parser === PARSER_TYPES.XML && options.xmlToJson === false))
        respType=SupportedContentTypeMetadata[PARSER_TYPES.TEXT].resp;
    const ret={[respType]: decodedObj.decoded};
    if(ctMeta.parser === PARSER_TYPES.MFD) {
        if(decodedObj.decoded[INTERNAL_MFD_FILE_KEY]) {
            ret[ResponseTypes.RESP_TYPE_FILE]=decodedObj.decoded[INTERNAL_MFD_FILE_KEY];
            delete decodedObj.decoded[INTERNAL_MFD_FILE_KEY];
        }
        await postProcessMFD(ret, options);
        return ret;
    }
    if(options.saveBodyToFile === false)
        return ret;
    const fileData:FileData=await saveIntoFile(ctMeta, decodedObj.raw, url, options.saveFilePath);
    return { [ResponseTypes.RESP_TYPE_FILE]: { [KEY_UPLOADED_FILE]: fileData}};
}

export async function parse(req: ServerRequest, 
                            options: ParserOptions = {}): Promise<any> {
    const err:string=checkRequest(req);
    if(err)
        return;
    const parseOptions:ParserOptions=getParseOptions(options);
    const ctMeta:ContentMeta=getContentMeta(req.headers);
    try {
        const decodedObj=await Parsers[ctMeta.parser](req, parseOptions);
        return await prepareResponse(req.url, ctMeta, decodedObj, parseOptions);
    } catch(err) {}
}

export type { ParserOptions, FileData }  from "./metadata.ts";