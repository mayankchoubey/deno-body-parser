import { parse } from "./mod.ts";
import * as ParserMeta from "./metadata.ts";
import { BufReader } from "https://deno.land/std/io/bufio.ts";
import { assertThrowsAsync, assert } from "https://deno.land/std/testing/asserts.ts";
import { ServerRequest } from "https://deno.land/std/http/server.ts";

const HDR_VAL_UNKNOWN_TYPE='x-unknown-type',
      LOCAL_DIR='./',
      TEMP_DIR='/var/tmp',
      OPTIONS_UNKNOWN_AS_TEXT={unknownAsText: true},
      OPTIONS_SAVE_BODY_TO_FILE={saveBodyToFile: true},
      OPTIONS_SAVE_BODY_TO_FILE_TO_PATH={saveBodyToFile: true, saveFilePath: TEMP_DIR},
      SAMPLE_FILE_PATH='./testData/sample',
      SIMPLE_TEXT_BODY_ALPHABET='ABCDEFGHIJKLMNOPQRSTUVWXYZ',
      SIMPLE_TEXT_BODY_NUMBERS='1234567890',
      EMPTY_JSON_BODY={};

function addHeaders(req: ServerRequest, name: string, value: string|number|undefined): void {
    if(!value)
        return;
    if(!req.headers)
        req.headers=new Headers();
    req.headers.set(name, `${value}`);
}

function encodeBody(input: string): BufReader {
    return new BufReader(new Deno.Buffer(new TextEncoder().encode(input)));
}

async function addBody(req: ServerRequest, ct: string|undefined, body: any, ext: string|undefined) {
    let len=0;
    addHeaders(req, ParserMeta.HTTP_Header.HDR_CONTENT_TYPE, ct);
    if(ext) {
        const filePath=`${SAMPLE_FILE_PATH}.${ext}`;
        const fileContent=await Deno.readFile(filePath);
        req.r = new BufReader(new Deno.Buffer(fileContent));
        len=fileContent.length;
    }
    else if(typeof body === 'object') {
        const encBody=JSON.stringify(body);
        req.r = encodeBody(encBody);
        len=encBody.length;
    }        
    else if(typeof body === 'string') {
        len=body.length;
        req.r = encodeBody(body);
    }
    addHeaders(req, ParserMeta.HTTP_Header.HDR_CONTENT_LENGTH, len);
}

async function fileAsserts(files:Array<ParserMeta.FileData>, initPath: string, ext: string, compareWithOrig:boolean=false) {
    assert(files.length === 1);
    const file=files[0];
    assert(file.path.length>0);
    assert(file.path.endsWith(ext));
    assert(file.path.startsWith(initPath));
    assert(file.size>0);
    if(compareWithOrig === true) {
        const origFilePath=`${SAMPLE_FILE_PATH}.${ext}`;
        const origFile=await Deno.readFile(origFilePath);
        const gotFile=await Deno.readFile(file.path);
        assert(gotFile.length === origFile.length);
    }
    await Deno.remove(file.path);
}

async function rawAsserts(ret:any, data:string|undefined, ext?:string) {
    assert(ret.raw.constructor === Uint8Array);
    if(!ext)
        assert(ret.raw.length === data?.length);
    else {
        const filePath=`${SAMPLE_FILE_PATH}.${ext}`;
        const origFile=await Deno.readFile(filePath);
        assert(ret.raw.length === origFile.length);
    }
}

async function textAsserts(ret:any, data:string|undefined, ext?:string) {
    assert(typeof ret.txt === 'string');
    if(!ext)
        assert(ret.txt.length === data?.length);
    else {
        const filePath=`${SAMPLE_FILE_PATH}.${ext}`;
        const origFile=await Deno.readFile(filePath);
        assert(ret.txt.length === origFile.length);
    }
}

async function dataAsserts(ret:any, data:string|undefined, ext?:string) {
    assert(typeof ret.data === 'object');
    if(!ext)
        assert(JSON.stringify(ret.data) === data);
    else {
        const filePath=`${SAMPLE_FILE_PATH}.${ext}`;
        const origFile=await Deno.readFile(filePath);
        const rcvdDataStr=JSON.stringify(ret.data),
              origDataStr=JSON.stringify(JSON.parse(new TextDecoder().decode(origFile)));
        assert(rcvdDataStr === origDataStr);
    }
}

async function prepareRequest(ct:string|undefined, body:any|undefined, ext:string|undefined) {
    const req=new ServerRequest();
    await addBody(req, ct, body, ext);
    return req;
}

Deno.test("empty req", async () => {
    const req=await prepareRequest(undefined, undefined, undefined);
    assertThrowsAsync(() => parse(req), Error);
});

Deno.test("hdr: H1/V1", async () => {
    const req=await prepareRequest(undefined, undefined, undefined);
    addHeaders(req, 'H1', 'V1');
    assertThrowsAsync( () => parse(req), Error);
});


Deno.test("cl=0", async () => {
    const req=await prepareRequest(undefined, undefined, undefined);
    addHeaders(req, ParserMeta.HTTP_Header.HDR_CONTENT_LENGTH, 0);
    assertThrowsAsync(() => parse(req), Error);
});

Deno.test("cl=0", async () => {
    const req=await prepareRequest(undefined, undefined, undefined);
    addHeaders(req, ParserMeta.HTTP_Header.HDR_CONTENT_LENGTH, 0);
    assertThrowsAsync(() => parse(req), Error);
});


Deno.test("cl=10, no ct", async () => {
    const req=await prepareRequest(undefined, undefined, undefined);
    addHeaders(req, ParserMeta.HTTP_Header.HDR_CONTENT_LENGTH, 10);
    assertThrowsAsync(() => parse(req), Error);
});

Deno.test("cl=10, ct=u, no body", async () => {
    const req=await prepareRequest(HDR_VAL_UNKNOWN_TYPE, undefined, undefined);
    addHeaders(req, ParserMeta.HTTP_Header.HDR_CONTENT_LENGTH, 10);
    const ret=await parse(req);
    assert(ret === undefined);
});

Deno.test(`ct=u, body=${SIMPLE_TEXT_BODY_ALPHABET}`, async () => {
    const req=await prepareRequest(HDR_VAL_UNKNOWN_TYPE, SIMPLE_TEXT_BODY_ALPHABET, undefined);
    const ret=await parse(req);
    await rawAsserts(ret, SIMPLE_TEXT_BODY_ALPHABET);
});

Deno.test(`ct=u, body=${SIMPLE_TEXT_BODY_ALPHABET}, uat`, async () => {
    const req=await prepareRequest(HDR_VAL_UNKNOWN_TYPE, SIMPLE_TEXT_BODY_ALPHABET, undefined);
    const ret=await parse(req, OPTIONS_UNKNOWN_AS_TEXT);
    await textAsserts(ret, SIMPLE_TEXT_BODY_ALPHABET);
});

Deno.test(`ct=u, body=${EMPTY_JSON_BODY}`, async () => {
    const req=await prepareRequest(HDR_VAL_UNKNOWN_TYPE, EMPTY_JSON_BODY, undefined);
    const ret=await parse(req);
    await rawAsserts(ret, JSON.stringify(EMPTY_JSON_BODY));
});

Deno.test(`ct=u, body=${SIMPLE_TEXT_BODY_NUMBERS}, sbtf`, async () => {
    const req=await prepareRequest(HDR_VAL_UNKNOWN_TYPE, SIMPLE_TEXT_BODY_NUMBERS, undefined);
    const ret=await parse(req, OPTIONS_SAVE_BODY_TO_FILE);
    await fileAsserts(ret.files, LOCAL_DIR, 'bin');
});

Deno.test(`ct=u, body=${SIMPLE_TEXT_BODY_NUMBERS}, sbtftp`, async () => {
    const req=await prepareRequest(HDR_VAL_UNKNOWN_TYPE, SIMPLE_TEXT_BODY_NUMBERS, undefined);
    const ret=await parse(req, OPTIONS_SAVE_BODY_TO_FILE_TO_PATH);
    await fileAsserts(ret.files, TEMP_DIR, 'bin');
});

Deno.test(`ct=audio/aac`, async () => {
    const ext='aac';
    const req=await prepareRequest(ParserMeta.MIME_CONTENT_TYPES.AUDIO_AAC, undefined, ext);
    const ret=await parse(req);
    await rawAsserts(ret, undefined, ext);
});

Deno.test(`ct=audio/aac, sbtf`, async () => {
    const ext='aac';
    const req=await prepareRequest(ParserMeta.MIME_CONTENT_TYPES.AUDIO_AAC, undefined, ext);
    const ret=await parse(req, OPTIONS_SAVE_BODY_TO_FILE);
    await fileAsserts(ret.files, LOCAL_DIR, ext, true);
});

Deno.test(`ct=audio/aac, sbtftp`, async () => {
    const ext='aac';
    const req=await prepareRequest(ParserMeta.MIME_CONTENT_TYPES.AUDIO_AAC, undefined, ext);
    const ret=await parse(req, OPTIONS_SAVE_BODY_TO_FILE_TO_PATH);
    await fileAsserts(ret.files, TEMP_DIR, ext, true);
});

Deno.test(`ct=application/octet-stream`, async () => {
    const ext='bin';
    const req=await prepareRequest(ParserMeta.MIME_CONTENT_TYPES.OCTET_STREAM, undefined, ext);
    const ret=await parse(req);
    await rawAsserts(ret, undefined, ext);
});

Deno.test(`ct=application/octet-stream, sbtf`, async () => {
    const ext='bin';
    const req=await prepareRequest(ParserMeta.MIME_CONTENT_TYPES.OCTET_STREAM, undefined, ext);
    const ret=await parse(req, OPTIONS_SAVE_BODY_TO_FILE);
    await fileAsserts(ret.files, LOCAL_DIR, ext, true);
});

Deno.test(`ct=application/octet-stream, sbtftp`, async () => {
    const ext='bin';
    const req=await prepareRequest(ParserMeta.MIME_CONTENT_TYPES.OCTET_STREAM, undefined, ext);
    const ret=await parse(req, OPTIONS_SAVE_BODY_TO_FILE_TO_PATH);
    await fileAsserts(ret.files, TEMP_DIR, ext, true);
});

Deno.test(`ct=application/x-bzip2`, async () => {
    const ext='bz2';
    const req=await prepareRequest(ParserMeta.MIME_CONTENT_TYPES.BZIP_2, undefined, ext);
    const ret=await parse(req);
    await rawAsserts(ret, undefined, ext);
});

Deno.test(`ct=application/x-bzip2, sbtf`, async () => {
    const ext='bz2';
    const req=await prepareRequest(ParserMeta.MIME_CONTENT_TYPES.BZIP_2, undefined, ext);
    const ret=await parse(req, OPTIONS_SAVE_BODY_TO_FILE);
    await fileAsserts(ret.files, LOCAL_DIR, ext, true);
});

Deno.test(`ct=application/x-bzip2, sbtftp`, async () => {
    const ext='bz2';
    const req=await prepareRequest(ParserMeta.MIME_CONTENT_TYPES.BZIP_2, undefined, ext);
    const ret=await parse(req, OPTIONS_SAVE_BODY_TO_FILE_TO_PATH);
    await fileAsserts(ret.files, TEMP_DIR, ext, true);
});

Deno.test(`ct=text/csv`, async () => {
    const ext='csv';
    const req=await prepareRequest(ParserMeta.MIME_CONTENT_TYPES.CSV, undefined, ext);
    const ret=await parse(req);
    await textAsserts(ret, undefined, ext);
});

Deno.test(`ct=text/csv, sbtf`, async () => {
    const ext='csv';
    const req=await prepareRequest(ParserMeta.MIME_CONTENT_TYPES.CSV, undefined, ext);
    const ret=await parse(req, OPTIONS_SAVE_BODY_TO_FILE);
    await fileAsserts(ret.files, LOCAL_DIR, ext, true);
});

Deno.test(`ct=text/csv, sbtftp`, async () => {
    const ext='csv';
    const req=await prepareRequest(ParserMeta.MIME_CONTENT_TYPES.CSV, undefined, ext);
    const ret=await parse(req, OPTIONS_SAVE_BODY_TO_FILE_TO_PATH);
    await fileAsserts(ret.files, TEMP_DIR, ext, true);
});

Deno.test(`ct=application/msword`, async () => {
    const ext='doc';
    const req=await prepareRequest(ParserMeta.MIME_CONTENT_TYPES.MS_WORD, undefined, ext);
    const ret=await parse(req);
    await rawAsserts(ret, undefined, ext);
});

Deno.test(`ct=application/msword, sbtf`, async () => {
    const ext='doc';
    const req=await prepareRequest(ParserMeta.MIME_CONTENT_TYPES.MS_WORD, undefined, ext);
    const ret=await parse(req, OPTIONS_SAVE_BODY_TO_FILE);
    await fileAsserts(ret.files, LOCAL_DIR, ext, true);
});

Deno.test(`ct=application/msword, sbtftp`, async () => {
    const ext='doc';
    const req=await prepareRequest(ParserMeta.MIME_CONTENT_TYPES.MS_WORD, undefined, ext);
    const ret=await parse(req, OPTIONS_SAVE_BODY_TO_FILE_TO_PATH);
    await fileAsserts(ret.files, TEMP_DIR, ext, true);
});

Deno.test(`ct=application/vnd.openxmlformats-officedocument.wordprocessingml.document`, async () => {
    const ext='docx';
    const req=await prepareRequest(ParserMeta.MIME_CONTENT_TYPES.MS_WORD_X, undefined, ext);
    const ret=await parse(req);
    await rawAsserts(ret, undefined, ext);
});

Deno.test(`ct=application/vnd.openxmlformats-officedocument.wordprocessingml.document, sbtf`, async () => {
    const ext='docx';
    const req=await prepareRequest(ParserMeta.MIME_CONTENT_TYPES.MS_WORD_X, undefined, ext);
    const ret=await parse(req, OPTIONS_SAVE_BODY_TO_FILE);
    await fileAsserts(ret.files, LOCAL_DIR, ext, true);
});

Deno.test(`ct=application/vnd.openxmlformats-officedocument.wordprocessingml.document, sbtftp`, async () => {
    const ext='docx';
    const req=await prepareRequest(ParserMeta.MIME_CONTENT_TYPES.MS_WORD_X, undefined, ext);
    const ret=await parse(req, OPTIONS_SAVE_BODY_TO_FILE_TO_PATH);
    await fileAsserts(ret.files, TEMP_DIR, ext, true);
});

Deno.test(`ct=application/epub+zip`, async () => {
    const ext='epub';
    const req=await prepareRequest(ParserMeta.MIME_CONTENT_TYPES.EPUB, undefined, ext);
    const ret=await parse(req);
    await rawAsserts(ret, undefined, ext);
});

Deno.test(`ct=application/epub+zip, sbtf`, async () => {
    const ext='epub';
    const req=await prepareRequest(ParserMeta.MIME_CONTENT_TYPES.EPUB, undefined, ext);
    const ret=await parse(req, OPTIONS_SAVE_BODY_TO_FILE);
    await fileAsserts(ret.files, LOCAL_DIR, ext, true);
});

Deno.test(`ct=application/epub+zip, sbtftp`, async () => {
    const ext='epub';
    const req=await prepareRequest(ParserMeta.MIME_CONTENT_TYPES.EPUB, undefined, ext);
    const ret=await parse(req, OPTIONS_SAVE_BODY_TO_FILE_TO_PATH);
    await fileAsserts(ret.files, TEMP_DIR, ext, true);
});

Deno.test(`ct=application/gzip`, async () => {
    const ext='gz';
    const req=await prepareRequest(ParserMeta.MIME_CONTENT_TYPES.GZ, undefined, ext);
    const ret=await parse(req);
    await rawAsserts(ret, undefined, ext);
});

Deno.test(`ct=application/gzip, sbtf`, async () => {
    const ext='gz';
    const req=await prepareRequest(ParserMeta.MIME_CONTENT_TYPES.GZ, undefined, ext);
    const ret=await parse(req, OPTIONS_SAVE_BODY_TO_FILE);
    await fileAsserts(ret.files, LOCAL_DIR, ext, true);
});

Deno.test(`ct=application/gzip, sbtftp`, async () => {
    const ext='gz';
    const req=await prepareRequest(ParserMeta.MIME_CONTENT_TYPES.GZ, undefined, ext);
    const ret=await parse(req, OPTIONS_SAVE_BODY_TO_FILE_TO_PATH);
    await fileAsserts(ret.files, TEMP_DIR, ext, true);
});

Deno.test(`ct=image/gif`, async () => {
    const ext='gif';
    const req=await prepareRequest(ParserMeta.MIME_CONTENT_TYPES.GIF, undefined, ext);
    const ret=await parse(req);
    await rawAsserts(ret, undefined, ext);
});

Deno.test(`ct=image/gif, sbtf`, async () => {
    const ext='gif';
    const req=await prepareRequest(ParserMeta.MIME_CONTENT_TYPES.GIF, undefined, ext);
    const ret=await parse(req, OPTIONS_SAVE_BODY_TO_FILE);
    await fileAsserts(ret.files, LOCAL_DIR, ext, true);
});

Deno.test(`ct=image/gif, sbtftp`, async () => {
    const ext='gif';
    const req=await prepareRequest(ParserMeta.MIME_CONTENT_TYPES.GIF, undefined, ext);
    const ret=await parse(req, OPTIONS_SAVE_BODY_TO_FILE_TO_PATH);
    await fileAsserts(ret.files, TEMP_DIR, ext, true);
});

Deno.test(`ct=text/html`, async () => {
    const ext='html';
    const req=await prepareRequest(ParserMeta.MIME_CONTENT_TYPES.HTML, undefined, ext);
    const ret=await parse(req);
    await textAsserts(ret, undefined, ext);
});

Deno.test(`ct=text/html, sbtf`, async () => {
    const ext='html';
    const req=await prepareRequest(ParserMeta.MIME_CONTENT_TYPES.HTML, undefined, ext);
    const ret=await parse(req, OPTIONS_SAVE_BODY_TO_FILE);
    await fileAsserts(ret.files, LOCAL_DIR, ext, true);
});

Deno.test(`ct=text/html, sbtftp`, async () => {
    const ext='html';
    const req=await prepareRequest(ParserMeta.MIME_CONTENT_TYPES.HTML, undefined, ext);
    const ret=await parse(req, OPTIONS_SAVE_BODY_TO_FILE_TO_PATH);
    await fileAsserts(ret.files, TEMP_DIR, ext, true);
});

Deno.test(`ct=image/jpeg`, async () => {
    const ext='jpg';
    const req=await prepareRequest(ParserMeta.MIME_CONTENT_TYPES.JPG, undefined, ext);
    const ret=await parse(req);
    await rawAsserts(ret, undefined, ext);
});

Deno.test(`ct=image/jpeg, sbtf`, async () => {
    const ext='jpg';
    const req=await prepareRequest(ParserMeta.MIME_CONTENT_TYPES.JPG, undefined, ext);
    const ret=await parse(req, OPTIONS_SAVE_BODY_TO_FILE);
    await fileAsserts(ret.files, LOCAL_DIR, ext, true);
});

Deno.test(`ct=image/jpeg, sbtftp`, async () => {
    const ext='jpg';
    const req=await prepareRequest(ParserMeta.MIME_CONTENT_TYPES.JPG, undefined, ext);
    const ret=await parse(req, OPTIONS_SAVE_BODY_TO_FILE_TO_PATH);
    await fileAsserts(ret.files, TEMP_DIR, ext, true);
});

Deno.test(`ct=application/json`, async () => {
    const ext='json';
    const req=await prepareRequest(ParserMeta.MIME_CONTENT_TYPES.JSON, undefined, ext);
    const ret=await parse(req);
    await dataAsserts(ret, undefined, ext);
});

Deno.test(`ct=application/json, incorrect`, async () => {
    const ext='json';
    const req=await prepareRequest(ParserMeta.MIME_CONTENT_TYPES.JSON, undefined, ext);
    const ret=await parse(req);
    await dataAsserts(ret, undefined, ext);
});

Deno.test(`ct=application/json, sbtf`, async () => {
    const ext='json';
    const req=await prepareRequest(ParserMeta.MIME_CONTENT_TYPES.JSON, undefined, ext);
    const ret=await parse(req, OPTIONS_SAVE_BODY_TO_FILE);
    await fileAsserts(ret.files, LOCAL_DIR, ext, true);
});

Deno.test(`ct=application/json, sbtftp`, async () => {
    const ext='json';
    const req=await prepareRequest(ParserMeta.MIME_CONTENT_TYPES.JSON, undefined, ext);
    const ret=await parse(req, OPTIONS_SAVE_BODY_TO_FILE_TO_PATH);
    await fileAsserts(ret.files, TEMP_DIR, ext, true);
});

Deno.test(`ct=audio/mpeg`, async () => {
    const ext='mp3';
    const req=await prepareRequest(ParserMeta.MIME_CONTENT_TYPES.MP3, undefined, ext);
    const ret=await parse(req);
    await rawAsserts(ret, undefined, ext);
});

Deno.test(`ct=audio/mpeg, sbtf`, async () => {
    const ext='mp3';
    const req=await prepareRequest(ParserMeta.MIME_CONTENT_TYPES.MP3, undefined, ext);
    const ret=await parse(req, OPTIONS_SAVE_BODY_TO_FILE);
    await fileAsserts(ret.files, LOCAL_DIR, ext, true);
});

Deno.test(`ct=audio/mpeg, sbtftp`, async () => {
    const ext='mp3';
    const req=await prepareRequest(ParserMeta.MIME_CONTENT_TYPES.MP3, undefined, ext);
    const ret=await parse(req, OPTIONS_SAVE_BODY_TO_FILE_TO_PATH);
    await fileAsserts(ret.files, TEMP_DIR, ext, true);
});


Deno.test(`ct=video/mp4`, async () => {
    const ext='mp4';
    const req=await prepareRequest(ParserMeta.MIME_CONTENT_TYPES.MP4, undefined, ext);
    const ret=await parse(req);
    await rawAsserts(ret, undefined, ext);
});

Deno.test(`ct=video/mp4, sbtf`, async () => {
    const ext='mp4';
    const req=await prepareRequest(ParserMeta.MIME_CONTENT_TYPES.MP4, undefined, ext);
    const ret=await parse(req, OPTIONS_SAVE_BODY_TO_FILE);
    await fileAsserts(ret.files, LOCAL_DIR, ext, true);
});

Deno.test(`ct=video/mp4, sbtftp`, async () => {
    const ext='mp4';
    const req=await prepareRequest(ParserMeta.MIME_CONTENT_TYPES.MP4, undefined, ext);
    const ret=await parse(req, OPTIONS_SAVE_BODY_TO_FILE_TO_PATH);
    await fileAsserts(ret.files, TEMP_DIR, ext, true);
});

Deno.test(`ct=video/mpeg`, async () => {
    const ext='mpeg';
    const req=await prepareRequest(ParserMeta.MIME_CONTENT_TYPES.MPEG, undefined, ext);
    const ret=await parse(req);
    await rawAsserts(ret, undefined, ext);
});

Deno.test(`ct=video/mpeg, sbtf`, async () => {
    const ext='mpeg';
    const req=await prepareRequest(ParserMeta.MIME_CONTENT_TYPES.MPEG, undefined, ext);
    const ret=await parse(req, OPTIONS_SAVE_BODY_TO_FILE);
    await fileAsserts(ret.files, LOCAL_DIR, ext, true);
});

Deno.test(`ct=video/mpeg, sbtftp`, async () => {
    const ext='mpeg';
    const req=await prepareRequest(ParserMeta.MIME_CONTENT_TYPES.MPEG, undefined, ext);
    const ret=await parse(req, OPTIONS_SAVE_BODY_TO_FILE_TO_PATH);
    await fileAsserts(ret.files, TEMP_DIR, ext, true);
});


Deno.test(`ct=image/png`, async () => {
    const ext='png';
    const req=await prepareRequest(ParserMeta.MIME_CONTENT_TYPES.PNG, undefined, ext);
    const ret=await parse(req);
    await rawAsserts(ret, undefined, ext);
});

Deno.test(`ct=image/png, sbtf`, async () => {
    const ext='png';
    const req=await prepareRequest(ParserMeta.MIME_CONTENT_TYPES.PNG, undefined, ext);
    const ret=await parse(req, OPTIONS_SAVE_BODY_TO_FILE);
    await fileAsserts(ret.files, LOCAL_DIR, ext, true);
});

Deno.test(`ct=image/png, sbtftp`, async () => {
    const ext='png';
    const req=await prepareRequest(ParserMeta.MIME_CONTENT_TYPES.PNG, undefined, ext);
    const ret=await parse(req, OPTIONS_SAVE_BODY_TO_FILE_TO_PATH);
    await fileAsserts(ret.files, TEMP_DIR, ext, true);
});

Deno.test(`ct=application/pdf`, async () => {
    const ext='pdf';
    const req=await prepareRequest(ParserMeta.MIME_CONTENT_TYPES.PDF, undefined, ext);
    const ret=await parse(req);
    await rawAsserts(ret, undefined, ext);
});

Deno.test(`ct=application/pdf, sbtf`, async () => {
    const ext='pdf';
    const req=await prepareRequest(ParserMeta.MIME_CONTENT_TYPES.PDF, undefined, ext);
    const ret=await parse(req, OPTIONS_SAVE_BODY_TO_FILE);
    await fileAsserts(ret.files, LOCAL_DIR, ext, true);
});

Deno.test(`ct=application/pdf, sbtftp`, async () => {
    const ext='pdf';
    const req=await prepareRequest(ParserMeta.MIME_CONTENT_TYPES.PDF, undefined, ext);
    const ret=await parse(req, OPTIONS_SAVE_BODY_TO_FILE_TO_PATH);
    await fileAsserts(ret.files, TEMP_DIR, ext, true);
});

Deno.test(`ct=application/vnd.ms-powerpoint`, async () => {
    const ext='ppt';
    const req=await prepareRequest(ParserMeta.MIME_CONTENT_TYPES.PPT, undefined, ext);
    const ret=await parse(req);
    await rawAsserts(ret, undefined, ext);
});

Deno.test(`ct=application/vnd.ms-powerpoint, sbtf`, async () => {
    const ext='ppt';
    const req=await prepareRequest(ParserMeta.MIME_CONTENT_TYPES.PPT, undefined, ext);
    const ret=await parse(req, OPTIONS_SAVE_BODY_TO_FILE);
    await fileAsserts(ret.files, LOCAL_DIR, ext, true);
});

Deno.test(`ct=application/vnd.ms-powerpoint, sbtftp`, async () => {
    const ext='ppt';
    const req=await prepareRequest(ParserMeta.MIME_CONTENT_TYPES.PPT, undefined, ext);
    const ret=await parse(req, OPTIONS_SAVE_BODY_TO_FILE_TO_PATH);
    await fileAsserts(ret.files, TEMP_DIR, ext, true);
});


Deno.test(`ct=application/vnd.openxmlformats-officedocument.presentationml.presentation`, async () => {
    const ext='pptx';
    const req=await prepareRequest(ParserMeta.MIME_CONTENT_TYPES.PPT_X, undefined, ext);
    const ret=await parse(req);
    await rawAsserts(ret, undefined, ext);
});

Deno.test(`ct=application/vnd.openxmlformats-officedocument.presentationml.presentation, sbtf`, async () => {
    const ext='pptx';
    const req=await prepareRequest(ParserMeta.MIME_CONTENT_TYPES.PPT_X, undefined, ext);
    const ret=await parse(req, OPTIONS_SAVE_BODY_TO_FILE);
    await fileAsserts(ret.files, LOCAL_DIR, ext, true);
});

Deno.test(`ct=application/vnd.openxmlformats-officedocument.presentationml.presentation, sbtftp`, async () => {
    const ext='pptx';
    const req=await prepareRequest(ParserMeta.MIME_CONTENT_TYPES.PPT_X, undefined, ext);
    const ret=await parse(req, OPTIONS_SAVE_BODY_TO_FILE_TO_PATH);
    await fileAsserts(ret.files, TEMP_DIR, ext, true);
});


Deno.test(`ct=application/vnd.rar`, async () => {
    const ext='rar';
    const req=await prepareRequest(ParserMeta.MIME_CONTENT_TYPES.RAR, undefined, ext);
    const ret=await parse(req);
    await rawAsserts(ret, undefined, ext);
});

Deno.test(`ct=application/vnd.rar, sbtf`, async () => {
    const ext='rar';
    const req=await prepareRequest(ParserMeta.MIME_CONTENT_TYPES.RAR, undefined, ext);
    const ret=await parse(req, OPTIONS_SAVE_BODY_TO_FILE);
    await fileAsserts(ret.files, LOCAL_DIR, ext, true);
});

Deno.test(`ct=application/vnd.rar, sbtftp`, async () => {
    const ext='rar';
    const req=await prepareRequest(ParserMeta.MIME_CONTENT_TYPES.RAR, undefined, ext);
    const ret=await parse(req, OPTIONS_SAVE_BODY_TO_FILE_TO_PATH);
    await fileAsserts(ret.files, TEMP_DIR, ext, true);
});

Deno.test(`ct=application/rtf`, async () => {
    const ext='rtf';
    const req=await prepareRequest(ParserMeta.MIME_CONTENT_TYPES.RTF, undefined, ext);
    const ret=await parse(req);
    await rawAsserts(ret, undefined, ext);
});

Deno.test(`ct=application/rtf, sbtf`, async () => {
    const ext='rtf';
    const req=await prepareRequest(ParserMeta.MIME_CONTENT_TYPES.RTF, undefined, ext);
    const ret=await parse(req, OPTIONS_SAVE_BODY_TO_FILE);
    await fileAsserts(ret.files, LOCAL_DIR, ext, true);
});

Deno.test(`ct=application/rtf, sbtftp`, async () => {
    const ext='rtf';
    const req=await prepareRequest(ParserMeta.MIME_CONTENT_TYPES.RTF, undefined, ext);
    const ret=await parse(req, OPTIONS_SAVE_BODY_TO_FILE_TO_PATH);
    await fileAsserts(ret.files, TEMP_DIR, ext, true);
});

Deno.test(`ct=image/svg+xml`, async () => {
    const ext='svg';
    const req=await prepareRequest(ParserMeta.MIME_CONTENT_TYPES.SVG, undefined, ext);
    const ret=await parse(req);
    await rawAsserts(ret, undefined, ext);
});

Deno.test(`ct=image/svg+xml, sbtf`, async () => {
    const ext='svg';
    const req=await prepareRequest(ParserMeta.MIME_CONTENT_TYPES.SVG, undefined, ext);
    const ret=await parse(req, OPTIONS_SAVE_BODY_TO_FILE);
    await fileAsserts(ret.files, LOCAL_DIR, ext, true);
});

Deno.test(`ct=image/svg+xml, sbtftp`, async () => {
    const ext='svg';
    const req=await prepareRequest(ParserMeta.MIME_CONTENT_TYPES.SVG, undefined, ext);
    const ret=await parse(req, OPTIONS_SAVE_BODY_TO_FILE_TO_PATH);
    await fileAsserts(ret.files, TEMP_DIR, ext, true);
});

Deno.test(`ct=application/x-tar`, async () => {
    const ext='tar';
    const req=await prepareRequest(ParserMeta.MIME_CONTENT_TYPES.TAR, undefined, ext);
    const ret=await parse(req);
    await rawAsserts(ret, undefined, ext);
});

Deno.test(`ct=application/x-tar, sbtf`, async () => {
    const ext='tar';
    const req=await prepareRequest(ParserMeta.MIME_CONTENT_TYPES.TAR, undefined, ext);
    const ret=await parse(req, OPTIONS_SAVE_BODY_TO_FILE);
    await fileAsserts(ret.files, LOCAL_DIR, ext, true);
});

Deno.test(`ct=application/x-tar, sbtftp`, async () => {
    const ext='tar';
    const req=await prepareRequest(ParserMeta.MIME_CONTENT_TYPES.TAR, undefined, ext);
    const ret=await parse(req, OPTIONS_SAVE_BODY_TO_FILE_TO_PATH);
    await fileAsserts(ret.files, TEMP_DIR, ext, true);
});


Deno.test(`ct=text/plain, body=${SIMPLE_TEXT_BODY_ALPHABET}`, async () => {
    const req=await prepareRequest(ParserMeta.MIME_CONTENT_TYPES.TEXT, SIMPLE_TEXT_BODY_ALPHABET, undefined);
    const ret=await parse(req);
    await textAsserts(ret, SIMPLE_TEXT_BODY_ALPHABET);
});

Deno.test(`ct=text/plain, body=${SIMPLE_TEXT_BODY_ALPHABET}, sbtf`, async () => {
    const req=await prepareRequest(ParserMeta.MIME_CONTENT_TYPES.TEXT, SIMPLE_TEXT_BODY_ALPHABET, undefined);
    const ret=await parse(req, OPTIONS_SAVE_BODY_TO_FILE);
    await fileAsserts(ret.files, LOCAL_DIR, 'txt');
});

Deno.test(`ct=text/plain, body=${SIMPLE_TEXT_BODY_ALPHABET}, sbtftp`, async () => {
    const req=await prepareRequest(ParserMeta.MIME_CONTENT_TYPES.TEXT, SIMPLE_TEXT_BODY_ALPHABET, undefined);
    const ret=await parse(req, OPTIONS_SAVE_BODY_TO_FILE_TO_PATH);
    await fileAsserts(ret.files, TEMP_DIR, 'txt');
});

Deno.test(`ct=text/plain, body=${SIMPLE_TEXT_BODY_NUMBERS}`, async () => {
    const req=await prepareRequest(ParserMeta.MIME_CONTENT_TYPES.TEXT, SIMPLE_TEXT_BODY_NUMBERS, undefined);
    const ret=await parse(req);
    await textAsserts(ret, SIMPLE_TEXT_BODY_NUMBERS);
});

Deno.test(`ct=text/plain, body=${SIMPLE_TEXT_BODY_NUMBERS}, sbtf`, async () => {
    const req=await prepareRequest(ParserMeta.MIME_CONTENT_TYPES.TEXT, SIMPLE_TEXT_BODY_NUMBERS, undefined);
    const ret=await parse(req, OPTIONS_SAVE_BODY_TO_FILE);
    await fileAsserts(ret.files, LOCAL_DIR, 'txt');
});

Deno.test(`ct=text/plain, body=${SIMPLE_TEXT_BODY_NUMBERS}, sbtftp`, async () => {
    const req=await prepareRequest(ParserMeta.MIME_CONTENT_TYPES.TEXT, SIMPLE_TEXT_BODY_NUMBERS, undefined);
    const ret=await parse(req, OPTIONS_SAVE_BODY_TO_FILE_TO_PATH);
    await fileAsserts(ret.files, TEMP_DIR, 'txt');
});

Deno.test(`ct=text/plain`, async () => {
    const ext='txt';
    const req=await prepareRequest(ParserMeta.MIME_CONTENT_TYPES.TEXT, undefined, ext);
    const ret=await parse(req);
    await textAsserts(ret, undefined, ext);
});

Deno.test(`ct=audio/wav`, async () => {
    const ext='wav';
    const req=await prepareRequest(ParserMeta.MIME_CONTENT_TYPES.WAV, undefined, ext);
    const ret=await parse(req);
    await rawAsserts(ret, undefined, ext);
});

Deno.test(`ct=audio/wav, sbtf`, async () => {
    const ext='wav';
    const req=await prepareRequest(ParserMeta.MIME_CONTENT_TYPES.WAV, undefined, ext);
    const ret=await parse(req, OPTIONS_SAVE_BODY_TO_FILE);
    await fileAsserts(ret.files, LOCAL_DIR, ext, true);
});

Deno.test(`ct=audio/wav, sbtftp`, async () => {
    const ext='wav';
    const req=await prepareRequest(ParserMeta.MIME_CONTENT_TYPES.WAV, undefined, ext);
    const ret=await parse(req, OPTIONS_SAVE_BODY_TO_FILE_TO_PATH);
    await fileAsserts(ret.files, TEMP_DIR, ext, true);
});

Deno.test(`ct=application/vnd.ms-excel`, async () => {
    const ext='xls';
    const req=await prepareRequest(ParserMeta.MIME_CONTENT_TYPES.XLS, undefined, ext);
    const ret=await parse(req);
    await rawAsserts(ret, undefined, ext);
});

Deno.test(`ct=application/vnd.ms-excel, sbtf`, async () => {
    const ext='xls';
    const req=await prepareRequest(ParserMeta.MIME_CONTENT_TYPES.XLS, undefined, ext);
    const ret=await parse(req, OPTIONS_SAVE_BODY_TO_FILE);
    await fileAsserts(ret.files, LOCAL_DIR, ext, true);
});

Deno.test(`ct=application/vnd.ms-excel, sbtftp`, async () => {
    const ext='xls';
    const req=await prepareRequest(ParserMeta.MIME_CONTENT_TYPES.XLS, undefined, ext);
    const ret=await parse(req, OPTIONS_SAVE_BODY_TO_FILE_TO_PATH);
    await fileAsserts(ret.files, TEMP_DIR, ext, true);
});

