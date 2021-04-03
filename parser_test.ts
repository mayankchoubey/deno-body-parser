import { parse } from "./mod.ts";
import * as ParserMeta from "./metadata.ts";
import { BufReader } from "https://deno.land/std/io/bufio.ts";
import { assertThrowsAsync, assert } from "https://deno.land/std/testing/asserts.ts";
import { ServerRequest } from "https://deno.land/std/http/server.ts";
import { MultipartWriter } from "https://deno.land/std/mime/mod.ts";

const   HDR_VAL_UNKNOWN_TYPE='x-unknown-type',
        LOCAL_DIR=await Deno.realPath('./'),
        TEMP_DIR='/private/var/tmp',
        OPTIONS_UNKNOWN_AS_TEXT={unknownAsText: true},
        OPTIONS_SAVE_BODY_TO_FILE={saveBodyToFile: true},
        OPTIONS_SAVE_BODY_TO_FILE_TO_PATH=Object.assign({}, OPTIONS_SAVE_BODY_TO_FILE, {saveFilePath: TEMP_DIR}),
        OPTIONS_NO_XML_TO_JSON={xmlToJson: false},
        SAMPLE_FILE_PATH='./testData/sample',
        SIMPLE_TEXT_BODY_ALPHABET='ABCDEFGHIJKLMNOPQRSTUVWXYZ',
        SIMPLE_TEXT_BODY_NUMBERS='1234567890',
        EMPTY_JSON_BODY={},
        SIMPLE_JSON_FOR_MFD={
            a: 1,
            b: 2,
            c: "d",
            e: "f"
        },
        URL_ENCODED_DATA={
        1: {
              a: "field1=value1&field2=value2&field3=true&field4=10&field5=0.5",
              b: JSON.stringify({field1: 'value1', field2: 'value2', field3: true, field4: 10, field5: 0.5})
        },
        2: {
            a: "str=this+string+has+spaces+in+it",
            b: JSON.stringify({ str: "this string has spaces in it" })
        },
        3: {
            a: "a=5&b=true&c=false",
            b: JSON.stringify({a: 5, b: true, c: false})
        },
        4: {
            a: "=4",
            b: JSON.stringify({ "": 4 })
        },
        5: {
            a: "5=",
            b: JSON.stringify({"5": ""})
        }
      },
      XML_SAMPLE='<tag>tag content</tag><tag2>another content</tag2><tag3><insideTag>inside content</insideTag><emptyTag /></tag3>',
      XML_STR=JSON.stringify({tag: "tag content", tag2: "another content", tag3: { insideTag: "inside content", emptyTag: null }});

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
        if(ct !== ParserMeta.MIME_CONTENT_TYPES.MULTIPART_FORM_DATA) {
            const encBody=JSON.stringify(body);
            req.r = encodeBody(encBody);
            len=encBody.length;
        } else {
            const buf = new Deno.Buffer();
            const mw = new MultipartWriter(buf);
            let fileCount=1;
            for(const k in body) {
                if(k==='exts') {
                    for(const aFile of body[k]) {
                        const file:string=SAMPLE_FILE_PATH+aFile;
                        const fileHdl = await Deno.open(file, { read: true });
                        await mw.writeFile('filefield'+fileCount, file.split('/')?.pop()||'./sample.abcd', fileHdl);
                        fileCount++;
                        fileHdl.close();
                    }
                    delete body[k];
                } else
                    await mw.writeField(k, body[k]);
            }
            mw.close();
            req.r=new BufReader(buf);
            len=buf.length;
            addHeaders(req, ParserMeta.HTTP_Header.HDR_CONTENT_TYPE, mw.formDataContentType());
        }
    }        
    else if(typeof body === 'string') {
        len=body.length;
        req.r = encodeBody(body);
    }
    addHeaders(req, ParserMeta.HTTP_Header.HDR_CONTENT_LENGTH, len);
}

async function fileAsserts(files:Record<string, ParserMeta.FileData>, initPath: string, ext: string, compareWithOrig:boolean=false) {
    assert(Object.keys(files).length === 1);
    assert(Object.keys(files.uploadedFile).length>0)
    const file=files.uploadedFile;
    assert(file.path?.length||0>0);
    assert(file.path?.endsWith(ext));
    assert(file.name.length>0);
    assert(file.name.endsWith(ext));
    assert(file.path?.startsWith(initPath));
    assert(file.size>0);
    if(compareWithOrig === true) {
        const origFilePath=`${SAMPLE_FILE_PATH}.${ext}`;
        const origFile=await Deno.readFile(origFilePath);
        const gotFile=await Deno.readFile(file.path!);
        assert(gotFile.length === origFile.length);
    }
    await Deno.remove(file.path!);
}

async function mfdFileAsserts(files:Record<string, ParserMeta.FileData>, initPath: string, ext: string[], compareWithOrig:boolean=false) {
    assert(Object.keys(files).length>=1);
    let index=0;
    for(const fileO in files) {
        const fieldName:string='filefield'+`${index+1}`;
        assert(fileO === fieldName || fileO === "uploadedFile");
        const file:ParserMeta.FileData=files[fileO] || files["uploadedFile"];
        assert(file.path || file.content);
        assert(file.name.length>0);
        assert(file.name.endsWith(ext[index]));
        assert(file.size>0);
        if(compareWithOrig === true) {
            const origFilePath=`${SAMPLE_FILE_PATH}${ext[index]}`;
            const origFile=await Deno.readFile(origFilePath);
            if(file.path) {
                const gotFile=await Deno.readFile(file.path!);
                assert(gotFile.length === origFile.length);
            } else
                assert(file.content?.length === origFile.length);
        }
        if(file.path)
            await Deno.remove(file.path!);
        index++;
    }
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
    const ret=await parse(req);
    assert(ret === undefined);
});

Deno.test("hdr: H1/V1", async () => {
    const req=await prepareRequest(undefined, undefined, undefined);
    addHeaders(req, 'H1', 'V1');
    const ret=await parse(req);
    assert(ret === undefined);
});


Deno.test("cl=0", async () => {
    const req=await prepareRequest(undefined, undefined, undefined);
    addHeaders(req, ParserMeta.HTTP_Header.HDR_CONTENT_LENGTH, 0);
    const ret=await parse(req);
    assert(ret === undefined);
});

Deno.test("cl=0", async () => {
    const req=await prepareRequest(undefined, undefined, undefined);
    addHeaders(req, ParserMeta.HTTP_Header.HDR_CONTENT_LENGTH, 0);
    const ret=await parse(req);
    assert(ret === undefined);
});


Deno.test("cl=10, no ct", async () => {
    const req=await prepareRequest(undefined, undefined, undefined);
    addHeaders(req, ParserMeta.HTTP_Header.HDR_CONTENT_LENGTH, 10);
    const ret=await parse(req);
    assert(ret === undefined);
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

Deno.test(`ct=application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`, async () => {
    const ext='xlsx';
    const req=await prepareRequest(ParserMeta.MIME_CONTENT_TYPES.XLS_X, undefined, ext);
    const ret=await parse(req);
    await rawAsserts(ret, undefined, ext);
});

Deno.test(`ct=application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, sbtf`, async () => {
    const ext='xlsx';
    const req=await prepareRequest(ParserMeta.MIME_CONTENT_TYPES.XLS_X, undefined, ext);
    const ret=await parse(req, OPTIONS_SAVE_BODY_TO_FILE);
    await fileAsserts(ret.files, LOCAL_DIR, ext, true);
});

Deno.test(`ct=application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, sbtftp`, async () => {
    const ext='xlsx';
    const req=await prepareRequest(ParserMeta.MIME_CONTENT_TYPES.XLS_X, undefined, ext);
    const ret=await parse(req, OPTIONS_SAVE_BODY_TO_FILE_TO_PATH);
    await fileAsserts(ret.files, TEMP_DIR, ext, true);
});


Deno.test(`ct=application/zip`, async () => {
    const ext='zip';
    const req=await prepareRequest(ParserMeta.MIME_CONTENT_TYPES.ZIP, undefined, ext);
    const ret=await parse(req);
    await rawAsserts(ret, undefined, ext);
});

Deno.test(`ct=application/zip, sbtf`, async () => {
    const ext='zip';
    const req=await prepareRequest(ParserMeta.MIME_CONTENT_TYPES.ZIP, undefined, ext);
    const ret=await parse(req, OPTIONS_SAVE_BODY_TO_FILE);
    await fileAsserts(ret.files, LOCAL_DIR, ext, true);
});

Deno.test(`ct=application/zip, sbtftp`, async () => {
    const ext='zip';
    const req=await prepareRequest(ParserMeta.MIME_CONTENT_TYPES.ZIP, undefined, ext);
    const ret=await parse(req, OPTIONS_SAVE_BODY_TO_FILE_TO_PATH);
    await fileAsserts(ret.files, TEMP_DIR, ext, true);
});

Deno.test(`ct=application/x-www-form-urlencoded, body=1`, async () => {
    const req=await prepareRequest(ParserMeta.MIME_CONTENT_TYPES.URL_ENCODED, URL_ENCODED_DATA[1].a, undefined);
    const ret=await parse(req);
    await dataAsserts(ret, URL_ENCODED_DATA[1].b);
});

Deno.test(`ct=application/x-www-form-urlencoded, body=2`, async () => {
    const req=await prepareRequest(ParserMeta.MIME_CONTENT_TYPES.URL_ENCODED, URL_ENCODED_DATA[2].a, undefined);
    const ret=await parse(req);
    await dataAsserts(ret, URL_ENCODED_DATA[2].b);
});

Deno.test(`ct=application/x-www-form-urlencoded, body=3`, async () => {
    const req=await prepareRequest(ParserMeta.MIME_CONTENT_TYPES.URL_ENCODED, URL_ENCODED_DATA[3].a, undefined);
    const ret=await parse(req);
    await dataAsserts(ret, URL_ENCODED_DATA[3].b);
});

Deno.test(`ct=application/x-www-form-urlencoded, body=4`, async () => {
    const req=await prepareRequest(ParserMeta.MIME_CONTENT_TYPES.URL_ENCODED, URL_ENCODED_DATA[4].a, undefined);
    const ret=await parse(req);
    await dataAsserts(ret, URL_ENCODED_DATA[4].b);
});

Deno.test(`ct=application/x-www-form-urlencoded, body=5`, async () => {
    const req=await prepareRequest(ParserMeta.MIME_CONTENT_TYPES.URL_ENCODED, URL_ENCODED_DATA[5].a, undefined);
    const ret=await parse(req);
    await dataAsserts(ret, URL_ENCODED_DATA[5].b);
});

Deno.test(`ct=application/x-www-form-urlencoded, body=5, sbtf`, async () => {
    const ext='data';
    const req=await prepareRequest(ParserMeta.MIME_CONTENT_TYPES.URL_ENCODED, URL_ENCODED_DATA[5].a, undefined);
    const ret=await parse(req, OPTIONS_SAVE_BODY_TO_FILE);
    await fileAsserts(ret.files, LOCAL_DIR, ext, false);
});

Deno.test(`ct=application/x-www-form-urlencoded, body=5, sbtftp`, async () => {
    const ext='data';
    const req=await prepareRequest(ParserMeta.MIME_CONTENT_TYPES.URL_ENCODED, URL_ENCODED_DATA[5].a, undefined);
    const ret=await parse(req, OPTIONS_SAVE_BODY_TO_FILE_TO_PATH);
    await fileAsserts(ret.files, TEMP_DIR, ext, false);
});

Deno.test(`ct=text/xml, body=simple`, async () => {
    const req=await prepareRequest(ParserMeta.MIME_CONTENT_TYPES.XML, XML_SAMPLE, undefined);
    const ret=await parse(req);
    await dataAsserts(ret, XML_STR);
});

Deno.test(`ct=text/xml, body=simple`, async () => {
    const req=await prepareRequest(ParserMeta.MIME_CONTENT_TYPES.XML, XML_SAMPLE, undefined);
    const ret=await parse(req, OPTIONS_NO_XML_TO_JSON);
    await textAsserts(ret, XML_SAMPLE);
});

Deno.test(`ct=text/xml, body=sample, sbtf`, async () => {
    const ext='xml';
    const req=await prepareRequest(ParserMeta.MIME_CONTENT_TYPES.XML, undefined, ext);
    const ret=await parse(req, Object.assign({}, OPTIONS_SAVE_BODY_TO_FILE, OPTIONS_NO_XML_TO_JSON));
    await fileAsserts(ret.files, LOCAL_DIR, ext, true);
});

Deno.test(`ct=text/xml, body=sample, sbtftp`, async () => {
    const ext='xml';
    const req=await prepareRequest(ParserMeta.MIME_CONTENT_TYPES.XML, undefined, ext);
    const ret=await parse(req, Object.assign({}, OPTIONS_SAVE_BODY_TO_FILE_TO_PATH, OPTIONS_NO_XML_TO_JSON));
    await fileAsserts(ret.files, TEMP_DIR, ext, true);
});


Deno.test(`ct=multipart/form-data, body=simple`, async () => {
    const req=await prepareRequest(ParserMeta.MIME_CONTENT_TYPES.MULTIPART_FORM_DATA, SIMPLE_JSON_FOR_MFD, undefined);
    const ret=await parse(req);
    await dataAsserts(ret, JSON.stringify(SIMPLE_JSON_FOR_MFD));
});

Deno.test(`ct=multipart/form-data, body=k, 1f`, async () => {
    const exts=['.xls'];
    const req=await prepareRequest(ParserMeta.MIME_CONTENT_TYPES.MULTIPART_FORM_DATA, 
                                    Object.assign({}, SIMPLE_JSON_FOR_MFD, {exts}), undefined);
    const ret=await parse(req);
    await dataAsserts(ret, JSON.stringify(SIMPLE_JSON_FOR_MFD));
    await mfdFileAsserts(ret.files, LOCAL_DIR, exts, true);
});

Deno.test(`ct=multipart/form-data, body=k, 2f`, async () => {
    const exts=['.xls', '.xlsx'];
    const req=await prepareRequest(ParserMeta.MIME_CONTENT_TYPES.MULTIPART_FORM_DATA, 
                                    Object.assign({}, SIMPLE_JSON_FOR_MFD, {exts}), undefined);
    const ret=await parse(req);
    await dataAsserts(ret, JSON.stringify(SIMPLE_JSON_FOR_MFD));
    await mfdFileAsserts(ret.files, LOCAL_DIR, exts, true);
});

Deno.test(`ct=multipart/form-data, body=k, 2f, bigfile`, async () => {
    const exts=['.xls', '.mp4'];
    const req=await prepareRequest(ParserMeta.MIME_CONTENT_TYPES.MULTIPART_FORM_DATA, 
                                    Object.assign({}, SIMPLE_JSON_FOR_MFD, {exts}), undefined);
    const ret=await parse(req);
    await dataAsserts(ret, JSON.stringify(SIMPLE_JSON_FOR_MFD));
    await mfdFileAsserts(ret.files, LOCAL_DIR, exts, true);
});

Deno.test(`ct=multipart/form-data, body=simple, sbtf`, async () => {
    const ext='json';
    const req=await prepareRequest(ParserMeta.MIME_CONTENT_TYPES.MULTIPART_FORM_DATA, SIMPLE_JSON_FOR_MFD, undefined);
    const ret=await parse(req, OPTIONS_SAVE_BODY_TO_FILE);
    await fileAsserts(ret.files, LOCAL_DIR, ext, false);
});

Deno.test(`ct=multipart/form-data, body=simple, sbtftp`, async () => {
    const ext='json';
    const req=await prepareRequest(ParserMeta.MIME_CONTENT_TYPES.MULTIPART_FORM_DATA, SIMPLE_JSON_FOR_MFD, undefined);
    const ret=await parse(req, OPTIONS_SAVE_BODY_TO_FILE_TO_PATH);
    await fileAsserts(ret.files, TEMP_DIR, ext, false);
});

Deno.test(`ct=multipart/form-data, body=k, 1f, sbtf`, async () => {
    const exts=['.xls'];
    const req=await prepareRequest(ParserMeta.MIME_CONTENT_TYPES.MULTIPART_FORM_DATA, 
                                    Object.assign({}, SIMPLE_JSON_FOR_MFD, {exts}), undefined);
    const ret=await parse(req, OPTIONS_SAVE_BODY_TO_FILE);
    //await dataAsserts(ret, JSON.stringify(SIMPLE_JSON_FOR_MFD));
    exts.push('.json');
    await mfdFileAsserts(ret.files, LOCAL_DIR, exts, false);
});

Deno.test(`ct=multipart/form-data, body=k, 2f, sbtftp`, async () => {
    const exts=['.xls', '.html'];
    const req=await prepareRequest(ParserMeta.MIME_CONTENT_TYPES.MULTIPART_FORM_DATA, 
                                    Object.assign({}, SIMPLE_JSON_FOR_MFD, {exts}), undefined);
    const ret=await parse(req, OPTIONS_SAVE_BODY_TO_FILE);
    //await dataAsserts(ret, JSON.stringify(SIMPLE_JSON_FOR_MFD));
    exts.push('.json');
    await mfdFileAsserts(ret.files, LOCAL_DIR, exts, false);
});