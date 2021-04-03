'use strict';

export enum PARSER_TYPES {
    BINARY='BINARY',
    TEXT='TEXT',
    JSON='JSON',
    MFD='MFD',
    URL_ENCODED='URL_ENCODED',
    XML='XML',
    UNKNOWN='UNKNOWN'
};

export interface ParserOptions {
    unknownAsText?: boolean,
    xmlToJson?: boolean,
    saveBodyToFile?: boolean,
    saveFilePath?: string
};

export interface FileData {
    name: string,
    type: string,
    size: number,
    path?: string,
    content?: Uint8Array
};

export enum PARSER_ERRORS {
    REQUEST_NULL="Request object is null",
    REQUEST_EMPTY="Request object is empty",
    CONTENT_LENGTH_MISSING_OR_ZERO="Content length is 0 or missing",
    CONTENT_TYPE_MISSING_OR_EMPTY="Content type is missing or empty",
    NONE=""
};

export enum HTTP_Header {
    HDR_CONTENT_LENGTH='content-length',
    HDR_CONTENT_TYPE='content-type'
};

export enum InternalContentTypes {
    TEXT=1,
    HTML,
    JSON,
    MFD,
    AUDIO_AAC,
    OCTET_STREAM,
    UNKNOWN=99
}

export enum ResponseTypes {
    RESP_TYPE_TXT='txt',
    RESP_TYPE_BINARY='raw',
    RESP_TYPE_DATA='data',
    RESP_TYPE_FILE='files'
};

export enum MIME_CONTENT_TYPES {
    AUDIO_AAC='audio/aac',
    OCTET_STREAM='application/octet-stream',
    BZIP='application/x-bzip',
    BZIP_2='application/x-bzip2',
    CSV='text/csv',
    MS_WORD='application/msword',
    MS_WORD_X='application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    EPUB='application/epub+zip',
    GZ='application/gzip',
    GIF='image/gif',
    HTML='text/html',
    JPG='image/jpeg',
    JSON='application/json',
    MP3='audio/mpeg',
    MP4='video/mp4',
    MPEG='video/mpeg',
    PNG='image/png',
    PDF='application/pdf',
    PPT='application/vnd.ms-powerpoint',
    PPT_X='application/vnd.openxmlformats-officedocument.presentationml.presentation',
    RAR='application/vnd.rar',
    RTF='application/rtf',
    SVG='image/svg+xml',
    TAR='application/x-tar',
    TEXT='text/plain',
    WAV='audio/wav',
    XLS='application/vnd.ms-excel',
    XLS_X='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ZIP='application/zip',
    URL_ENCODED='x-www-form-urlencoded',
    XML="text/xml",
    MULTIPART_FORM_DATA='multipart/form-data',
    
    
}

export interface ContentMeta {
    ct: string,
    ext: string,
    resp: string,
    parser: string
};

export const INTERNAL_MFD_FILE_KEY='__mfd__files__';

export const SupportedContentTypeMetadata: {[index: string]:any}={
    AUDIO_AAC: {
        ct: MIME_CONTENT_TYPES.AUDIO_AAC,
        ext: 'aac',
        resp: ResponseTypes.RESP_TYPE_BINARY,
        parser: PARSER_TYPES.BINARY
    },
    OCTET_STREAM: {
        ct: MIME_CONTENT_TYPES.OCTET_STREAM,
        ext: 'bin',
        resp: ResponseTypes.RESP_TYPE_BINARY,
        parser: PARSER_TYPES.BINARY
    },
    BZIP: {
        ct: MIME_CONTENT_TYPES.BZIP,
        ext: 'bz',
        resp: ResponseTypes.RESP_TYPE_BINARY,
        parser: PARSER_TYPES.BINARY
    },
    BZIP_2: {
        ct: MIME_CONTENT_TYPES.BZIP_2,
        ext: 'bz2',
        resp: ResponseTypes.RESP_TYPE_BINARY,
        parser: PARSER_TYPES.BINARY
    },
    CSV: {
        ct: MIME_CONTENT_TYPES.CSV,
        ext: 'csv',
        resp: ResponseTypes.RESP_TYPE_TXT,
        parser: PARSER_TYPES.TEXT
    },
    MS_WORD: {
        ct: MIME_CONTENT_TYPES.MS_WORD,
        ext: 'doc',
        resp: ResponseTypes.RESP_TYPE_BINARY,
        parser: PARSER_TYPES.BINARY
    },
    MS_WORD_X: {
        ct: MIME_CONTENT_TYPES.MS_WORD_X,
        ext: 'docx',
        resp: ResponseTypes.RESP_TYPE_BINARY,
        parser: PARSER_TYPES.BINARY
    },
    EPUB: {
        ct: MIME_CONTENT_TYPES.EPUB,
        ext: 'epub',
        resp: ResponseTypes.RESP_TYPE_BINARY,
        parser: PARSER_TYPES.BINARY
    },
    GZ: {
        ct: MIME_CONTENT_TYPES.GZ,
        ext: 'gz',
        resp: ResponseTypes.RESP_TYPE_BINARY,
        parser: PARSER_TYPES.BINARY
    },
    GIF: {
        ct: MIME_CONTENT_TYPES.GIF,
        ext: 'gif',
        resp: ResponseTypes.RESP_TYPE_BINARY,
        parser: PARSER_TYPES.BINARY
    },
    HTML: {
        ct: MIME_CONTENT_TYPES.HTML,
        ext: 'html',
        resp: ResponseTypes.RESP_TYPE_TXT,
        parser: PARSER_TYPES.TEXT
    },
    JPG: {
        ct: MIME_CONTENT_TYPES.JPG,
        ext: 'jpg',
        resp: ResponseTypes.RESP_TYPE_BINARY,
        parser: PARSER_TYPES.BINARY
    },
    JSON: {
        ct: MIME_CONTENT_TYPES.JSON,
        ext: 'json',
        resp: ResponseTypes.RESP_TYPE_DATA,
        parser: PARSER_TYPES.JSON
    },
    MP3: {
        ct: MIME_CONTENT_TYPES.MP3,
        ext: 'mp3',
        resp: ResponseTypes.RESP_TYPE_BINARY,
        parser: PARSER_TYPES.BINARY
    },
    MP4: {
        ct: MIME_CONTENT_TYPES.MP4,
        ext: 'mp4',
        resp: ResponseTypes.RESP_TYPE_BINARY,
        parser: PARSER_TYPES.BINARY
    },
    MPEG: {
        ct: MIME_CONTENT_TYPES.MPEG,
        ext: 'mpeg',
        resp: ResponseTypes.RESP_TYPE_BINARY,
        parser: PARSER_TYPES.BINARY
    },
    PNG: {
        ct: MIME_CONTENT_TYPES.PNG,
        ext: 'png',
        resp: ResponseTypes.RESP_TYPE_BINARY,
        parser: PARSER_TYPES.BINARY
    },
    PDF: {
        ct: MIME_CONTENT_TYPES.PDF,
        ext: 'pdf',
        resp: ResponseTypes.RESP_TYPE_BINARY,
        parser: PARSER_TYPES.BINARY
    },
    PPT: {
        ct: MIME_CONTENT_TYPES.PPT,
        ext: 'ppt',
        resp: ResponseTypes.RESP_TYPE_BINARY,
        parser: PARSER_TYPES.BINARY
    },
    PPT_X: {
        ct: MIME_CONTENT_TYPES.PPT_X,
        ext: 'pptx',
        resp: ResponseTypes.RESP_TYPE_BINARY,
        parser: PARSER_TYPES.BINARY
    },
    RAR: {
        ct: MIME_CONTENT_TYPES.RAR,
        ext: 'rar',
        resp: ResponseTypes.RESP_TYPE_BINARY,
        parser: PARSER_TYPES.BINARY
    },
    RTF: {
        ct: MIME_CONTENT_TYPES.RTF,
        ext: 'rtf',
        resp: ResponseTypes.RESP_TYPE_BINARY,
        parser: PARSER_TYPES.BINARY
    },
    SVG: {
        ct: MIME_CONTENT_TYPES.SVG,
        ext: 'svg',
        resp: ResponseTypes.RESP_TYPE_BINARY,
        parser: PARSER_TYPES.BINARY
    },
    TAR: {
        ct: MIME_CONTENT_TYPES.TAR,
        ext: 'tar',
        resp: ResponseTypes.RESP_TYPE_BINARY,
        parser: PARSER_TYPES.BINARY
    },
    TEXT: {
        ct: MIME_CONTENT_TYPES.TEXT,
        ext: 'txt',
        resp: ResponseTypes.RESP_TYPE_TXT,
        parser: PARSER_TYPES.TEXT
    },
    WAV: {
        ct: MIME_CONTENT_TYPES.WAV,
        ext: 'wav',
        resp: ResponseTypes.RESP_TYPE_BINARY,
        parser: PARSER_TYPES.BINARY
    },
    XLS: {
        ct: MIME_CONTENT_TYPES.XLS,
        ext: 'xls',
        resp: ResponseTypes.RESP_TYPE_BINARY,
        parser: PARSER_TYPES.BINARY
    },
    XLS_X: {
        ct: MIME_CONTENT_TYPES.XLS_X,
        ext: 'xlsx',
        resp: ResponseTypes.RESP_TYPE_BINARY,
        parser: PARSER_TYPES.BINARY
    },
    ZIP: {
        ct: MIME_CONTENT_TYPES.ZIP,
        ext: 'zip',
        resp: ResponseTypes.RESP_TYPE_BINARY,
        parser: PARSER_TYPES.BINARY
    },
    URL_ENCODED: {
        ct: MIME_CONTENT_TYPES.URL_ENCODED,
        ext: 'data',
        resp: ResponseTypes.RESP_TYPE_DATA,
        parser: PARSER_TYPES.URL_ENCODED
    },
    XML: {
        ct: MIME_CONTENT_TYPES.XML,
        ext: 'xml',
        resp: ResponseTypes.RESP_TYPE_DATA,
        parser: PARSER_TYPES.XML
    },
    MFD: {
        ct: MIME_CONTENT_TYPES.MULTIPART_FORM_DATA,
        ext: 'data',
        resp: ResponseTypes.RESP_TYPE_DATA,
        parser: PARSER_TYPES.MFD
    },

    UNKNOWN: {
        ct: 'UNKNOWN',
        ext: 'bin',
        resp: ResponseTypes.RESP_TYPE_BINARY,
        parser: PARSER_TYPES.UNKNOWN
    }
};
