var Module = typeof WDOSBOX !== "undefined" ? WDOSBOX : {};

/////// Custom module functionality
function getDescendantProp(obj, desc) {
  var arr = desc.split(".");
  while (arr.length && (obj = obj[arr.shift()]));
  return obj;
}
postMessage({target: 'loaded'});
Module.version = 999;
Module.ping = () => { };
Module["onCustomMessage"] = function (event) {
  var cmd = event.data.cmd;
  var args = event.data.args;
  var result = null;
  try {
    if (cmd === 'unzip') {
      var bytes = args[0];
      var buffer = Module['_malloc'](bytes.length);
      Module['HEAPU8'].set(bytes, buffer);
      result = Module['_extract_zip'](buffer, bytes.length);
      Module['_free'](buffer);
    } else if (cmd === 'run') {
      arguments_ = args;
      shouldRunNow = true;
      Module['callMain'](args);
    } else {
      const property = getDescendantProp(window, cmd);

      if (typeof property === 'function') {
        result = property.apply(globalThis, args);
      } else {
        result = JSON.parse(JSON.stringify(property));
      }
    }

  } catch (error) {
    postMessage({ target: 'custom', id: event.data.id, error: true, result: 'Worker:'+cmd + error.message }, []);
  } finally {
    postMessage({ target: 'custom', id: event.data.id, result: 0 }, []);
  }
};
var moduleOverrides = {};
var key;
for (key in Module) {
  if (Module.hasOwnProperty(key)) {
    moduleOverrides[key] = Module[key]
  }
}
var arguments_ = [];
var thisProgram = "./this.program";
var quit_ = function (status, toThrow) {
  throw toThrow
};
var ENVIRONMENT_IS_WEB = false;
var ENVIRONMENT_IS_WORKER = false;
var ENVIRONMENT_IS_NODE = false;
var ENVIRONMENT_HAS_NODE = false;
var ENVIRONMENT_IS_SHELL = false;
ENVIRONMENT_IS_WEB = typeof window === "object";
ENVIRONMENT_IS_WORKER = typeof importScripts === "function";
ENVIRONMENT_HAS_NODE = typeof process === "object" && typeof process.versions === "object" && typeof process.versions.node === "string";
ENVIRONMENT_IS_NODE = ENVIRONMENT_HAS_NODE && !ENVIRONMENT_IS_WEB && !ENVIRONMENT_IS_WORKER;
ENVIRONMENT_IS_SHELL = !ENVIRONMENT_IS_WEB && !ENVIRONMENT_IS_NODE && !ENVIRONMENT_IS_WORKER;
var scriptDirectory = "";

function locateFile(path) {
  if (Module["locateFile"]) {
    return Module["locateFile"](path, scriptDirectory)
  }
  return scriptDirectory + path
}
var read_, readAsync, readBinary, setWindowTitle;
if (ENVIRONMENT_IS_NODE) {
  scriptDirectory = __dirname + "/";
  var nodeFS;
  var nodePath;
  read_ = function shell_read(filename, binary) {
    var ret;
    if (!nodeFS) nodeFS = require("fs");
    if (!nodePath) nodePath = require("path");
    filename = nodePath["normalize"](filename);
    ret = nodeFS["readFileSync"](filename);
    return binary ? ret : ret.toString()
  };
  readBinary = function readBinary(filename) {
    var ret = read_(filename, true);
    if (!ret.buffer) {
      ret = new Uint8Array(ret)
    }
    assert(ret.buffer);
    return ret
  };
  if (process["argv"].length > 1) {
    thisProgram = process["argv"][1].replace(/\\/g, "/")
  }
  arguments_ = process["argv"].slice(2);
  if (typeof module !== "undefined") {
    module["exports"] = Module
  }
  process["on"]("uncaughtException", function (ex) {
    if (!(ex instanceof ExitStatus)) {
      throw ex
    }
  });
  process["on"]("unhandledRejection", abort);
  quit_ = function (status) {
    process["exit"](status)
  };
  Module["inspect"] = function () {
    return "[Emscripten Module object]"
  }
} else if (ENVIRONMENT_IS_SHELL) {
  if (typeof read != "undefined") {
    read_ = function shell_read(f) {
      return read(f)
    }
  }
  readBinary = function readBinary(f) {
    var data;
    if (typeof readbuffer === "function") {
      return new Uint8Array(readbuffer(f))
    }
    data = read(f, "binary");
    assert(typeof data === "object");
    return data
  };
  if (typeof scriptArgs != "undefined") {
    arguments_ = scriptArgs
  } else if (typeof arguments != "undefined") {
    arguments_ = arguments
  }
  if (typeof quit === "function") {
    quit_ = function (status) {
      quit(status)
    }
  }
  if (typeof print !== "undefined") {
    if (typeof console === "undefined") console = {};
    console.log = print;
    console.warn = console.error = typeof printErr !== "undefined" ? printErr : print
  }
} else if (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) {
  if (ENVIRONMENT_IS_WORKER) {
    scriptDirectory = self.location.href
  } else if (document.currentScript) {
    scriptDirectory = document.currentScript.src
  }
  if (scriptDirectory.indexOf("blob:") !== 0) {
    scriptDirectory = scriptDirectory.substr(0, scriptDirectory.lastIndexOf("/") + 1)
  } else {
    scriptDirectory = ""
  }
  read_ = function shell_read(url) {
    var xhr = new XMLHttpRequest;
    xhr.open("GET", url, false);
    xhr.send(null);
    return xhr.responseText
  };
  if (ENVIRONMENT_IS_WORKER) {
    readBinary = function readBinary(url) {
      var xhr = new XMLHttpRequest;
      xhr.open("GET", url, false);
      xhr.responseType = "arraybuffer";
      xhr.send(null);
      return new Uint8Array(xhr.response)
    }
  }
  readAsync = function readAsync(url, onload, onerror) {
    var xhr = new XMLHttpRequest;
    xhr.open("GET", url, true);
    xhr.responseType = "arraybuffer";
    xhr.onload = function xhr_onload() {
      if (xhr.status == 200 || xhr.status == 0 && xhr.response) {
        onload(xhr.response);
        return
      }
      onerror()
    };
    xhr.onerror = onerror;
    xhr.send(null)
  };
  setWindowTitle = function (title) {
    document.title = title
  }
} else { }
var out = Module["print"] || console.log.bind(console);
var err = Module["printErr"] || console.warn.bind(console);
for (key in moduleOverrides) {
  if (moduleOverrides.hasOwnProperty(key)) {
    Module[key] = moduleOverrides[key]
  }
}
moduleOverrides = null;
if (Module["arguments"]) arguments_ = Module["arguments"];
if (Module["thisProgram"]) thisProgram = Module["thisProgram"];
if (Module["quit"]) quit_ = Module["quit"];

function dynamicAlloc(size) {
  var ret = HEAP32[DYNAMICTOP_PTR >> 2];
  var end = ret + size + 15 & -16;
  if (end > _emscripten_get_heap_size()) {
    abort()
  }
  HEAP32[DYNAMICTOP_PTR >> 2] = end;
  return ret
}

function getNativeTypeSize(type) {
  switch (type) {
    case "i1":
    case "i8":
      return 1;
    case "i16":
      return 2;
    case "i32":
      return 4;
    case "i64":
      return 8;
    case "float":
      return 4;
    case "double":
      return 8;
    default: {
      if (type[type.length - 1] === "*") {
        return 4
      } else if (type[0] === "i") {
        var bits = parseInt(type.substr(1));
        assert(bits % 8 === 0, "getNativeTypeSize invalid bits " + bits + ", type " + type);
        return bits / 8
      } else {
        return 0
      }
    }
  }
}

function warnOnce(text) {
  if (!warnOnce.shown) warnOnce.shown = {};
  if (!warnOnce.shown[text]) {
    warnOnce.shown[text] = 1;
    err(text)
  }
}
var asm2wasmImports = {
  "f64-rem": function (x, y) {
    return x % y
  },
  "debugger": function () { }
};
var functionPointers = new Array(0);
var tempRet0 = 0;
var setTempRet0 = function (value) {
  tempRet0 = value
};
var getTempRet0 = function () {
  return tempRet0
};
var wasmBinary;
if (Module["wasmBinary"]) wasmBinary = Module["wasmBinary"];
var noExitRuntime;
if (Module["noExitRuntime"]) noExitRuntime = Module["noExitRuntime"];
if (typeof WebAssembly !== "object") {
  err("no native wasm support detected")
}

function setValue(ptr, value, type, noSafe) {
  type = type || "i8";
  if (type.charAt(type.length - 1) === "*") type = "i32";
  switch (type) {
    case "i1":
      HEAP8[ptr >> 0] = value;
      break;
    case "i8":
      HEAP8[ptr >> 0] = value;
      break;
    case "i16":
      HEAP16[ptr >> 1] = value;
      break;
    case "i32":
      HEAP32[ptr >> 2] = value;
      break;
    case "i64":
      tempI64 = [value >>> 0, (tempDouble = value, +Math_abs(tempDouble) >= +1 ? tempDouble > +0 ? (Math_min(+Math_floor(tempDouble / +4294967296), +4294967295) | 0) >>> 0 : ~~+Math_ceil((tempDouble - +(~~tempDouble >>> 0)) / +4294967296) >>> 0 : 0)], HEAP32[ptr >> 2] = tempI64[0], HEAP32[ptr + 4 >> 2] = tempI64[1];
      break;
    case "float":
      HEAPF32[ptr >> 2] = value;
      break;
    case "double":
      HEAPF64[ptr >> 3] = value;
      break;
    default:
      abort("invalid type for setValue: " + type)
  }
}
var wasmMemory;
var wasmTable = new WebAssembly.Table({
  "initial": 2603,
  "maximum": 2603,
  "element": "anyfunc"
});
var ABORT = false;
var EXITSTATUS = 0;

function assert(condition, text) {
  if (!condition) {
    abort("Assertion failed: " + text)
  }
}
var ALLOC_NORMAL = 0;
var ALLOC_NONE = 3;

function allocate(slab, types, allocator, ptr) {
  var zeroinit, size;
  if (typeof slab === "number") {
    zeroinit = true;
    size = slab
  } else {
    zeroinit = false;
    size = slab.length
  }
  var singleType = typeof types === "string" ? types : null;
  var ret;
  if (allocator == ALLOC_NONE) {
    ret = ptr
  } else {
    ret = [_malloc, stackAlloc, dynamicAlloc][allocator](Math.max(size, singleType ? 1 : types.length))
  }
  if (zeroinit) {
    var stop;
    ptr = ret;
    assert((ret & 3) == 0);
    stop = ret + (size & ~3);
    for (; ptr < stop; ptr += 4) {
      HEAP32[ptr >> 2] = 0
    }
    stop = ret + size;
    while (ptr < stop) {
      HEAP8[ptr++ >> 0] = 0
    }
    return ret
  }
  if (singleType === "i8") {
    if (slab.subarray || slab.slice) {
      HEAPU8.set(slab, ret)
    } else {
      HEAPU8.set(new Uint8Array(slab), ret)
    }
    return ret
  }
  var i = 0,
    type, typeSize, previousType;
  while (i < size) {
    var curr = slab[i];
    type = singleType || types[i];
    if (type === 0) {
      i++;
      continue
    }
    if (type == "i64") type = "i32";
    setValue(ret + i, curr, type);
    if (previousType !== type) {
      typeSize = getNativeTypeSize(type);
      previousType = type
    }
    i += typeSize
  }
  return ret
}

function getMemory(size) {
  if (!runtimeInitialized) return dynamicAlloc(size);
  return _malloc(size)
}
var UTF8Decoder = typeof TextDecoder !== "undefined" ? new TextDecoder("utf8") : undefined;

function UTF8ArrayToString(u8Array, idx, maxBytesToRead) {
  var endIdx = idx + maxBytesToRead;
  var endPtr = idx;
  while (u8Array[endPtr] && !(endPtr >= endIdx)) ++endPtr;
  if (endPtr - idx > 16 && u8Array.subarray && UTF8Decoder) {
    return UTF8Decoder.decode(u8Array.subarray(idx, endPtr))
  } else {
    var str = "";
    while (idx < endPtr) {
      var u0 = u8Array[idx++];
      if (!(u0 & 128)) {
        str += String.fromCharCode(u0);
        continue
      }
      var u1 = u8Array[idx++] & 63;
      if ((u0 & 224) == 192) {
        str += String.fromCharCode((u0 & 31) << 6 | u1);
        continue
      }
      var u2 = u8Array[idx++] & 63;
      if ((u0 & 240) == 224) {
        u0 = (u0 & 15) << 12 | u1 << 6 | u2
      } else {
        u0 = (u0 & 7) << 18 | u1 << 12 | u2 << 6 | u8Array[idx++] & 63
      }
      if (u0 < 65536) {
        str += String.fromCharCode(u0)
      } else {
        var ch = u0 - 65536;
        str += String.fromCharCode(55296 | ch >> 10, 56320 | ch & 1023)
      }
    }
  }
  return str
}

function UTF8ToString(ptr, maxBytesToRead) {
  return ptr ? UTF8ArrayToString(HEAPU8, ptr, maxBytesToRead) : ""
}

function stringToUTF8Array(str, outU8Array, outIdx, maxBytesToWrite) {
  if (!(maxBytesToWrite > 0)) return 0;
  var startIdx = outIdx;
  var endIdx = outIdx + maxBytesToWrite - 1;
  for (var i = 0; i < str.length; ++i) {
    var u = str.charCodeAt(i);
    if (u >= 55296 && u <= 57343) {
      var u1 = str.charCodeAt(++i);
      u = 65536 + ((u & 1023) << 10) | u1 & 1023
    }
    if (u <= 127) {
      if (outIdx >= endIdx) break;
      outU8Array[outIdx++] = u
    } else if (u <= 2047) {
      if (outIdx + 1 >= endIdx) break;
      outU8Array[outIdx++] = 192 | u >> 6;
      outU8Array[outIdx++] = 128 | u & 63
    } else if (u <= 65535) {
      if (outIdx + 2 >= endIdx) break;
      outU8Array[outIdx++] = 224 | u >> 12;
      outU8Array[outIdx++] = 128 | u >> 6 & 63;
      outU8Array[outIdx++] = 128 | u & 63
    } else {
      if (outIdx + 3 >= endIdx) break;
      outU8Array[outIdx++] = 240 | u >> 18;
      outU8Array[outIdx++] = 128 | u >> 12 & 63;
      outU8Array[outIdx++] = 128 | u >> 6 & 63;
      outU8Array[outIdx++] = 128 | u & 63
    }
  }
  outU8Array[outIdx] = 0;
  return outIdx - startIdx
}

function stringToUTF8(str, outPtr, maxBytesToWrite) {
  return stringToUTF8Array(str, HEAPU8, outPtr, maxBytesToWrite)
}

function lengthBytesUTF8(str) {
  var len = 0;
  for (var i = 0; i < str.length; ++i) {
    var u = str.charCodeAt(i);
    if (u >= 55296 && u <= 57343) u = 65536 + ((u & 1023) << 10) | str.charCodeAt(++i) & 1023;
    if (u <= 127) ++len;
    else if (u <= 2047) len += 2;
    else if (u <= 65535) len += 3;
    else len += 4
  }
  return len
}
var UTF16Decoder = typeof TextDecoder !== "undefined" ? new TextDecoder("utf-16le") : undefined;

function UTF16ToString(ptr) {
  var endPtr = ptr;
  var idx = endPtr >> 1;
  while (HEAP16[idx]) ++idx;
  endPtr = idx << 1;
  if (endPtr - ptr > 32 && UTF16Decoder) {
    return UTF16Decoder.decode(HEAPU8.subarray(ptr, endPtr))
  } else {
    var i = 0;
    var str = "";
    while (1) {
      var codeUnit = HEAP16[ptr + i * 2 >> 1];
      if (codeUnit == 0) return str;
      ++i;
      str += String.fromCharCode(codeUnit)
    }
  }
}

function allocateUTF8(str) {
  var size = lengthBytesUTF8(str) + 1;
  var ret = _malloc(size);
  if (ret) stringToUTF8Array(str, HEAP8, ret, size);
  return ret
}

function allocateUTF8OnStack(str) {
  var size = lengthBytesUTF8(str) + 1;
  var ret = stackAlloc(size);
  stringToUTF8Array(str, HEAP8, ret, size);
  return ret
}

function writeArrayToMemory(array, buffer) {
  HEAP8.set(array, buffer)
}

function writeAsciiToMemory(str, buffer, dontAddNull) {
  for (var i = 0; i < str.length; ++i) {
    HEAP8[buffer++ >> 0] = str.charCodeAt(i)
  }
  if (!dontAddNull) HEAP8[buffer >> 0] = 0
}
var WASM_PAGE_SIZE = 65536;

function alignUp(x, multiple) {
  if (x % multiple > 0) {
    x += multiple - x % multiple
  }
  return x
}
var buffer, HEAP8, HEAPU8, HEAP16, HEAPU16, HEAP32, HEAPU32, HEAPF32, HEAPF64;

function updateGlobalBufferAndViews(buf) {
  buffer = buf;
  Module["HEAP8"] = HEAP8 = new Int8Array(buf);
  Module["HEAP16"] = HEAP16 = new Int16Array(buf);
  Module["HEAP32"] = HEAP32 = new Int32Array(buf);
  Module["HEAPU8"] = HEAPU8 = new Uint8Array(buf);
  Module["HEAPU16"] = HEAPU16 = new Uint16Array(buf);
  Module["HEAPU32"] = HEAPU32 = new Uint32Array(buf);
  Module["HEAPF32"] = HEAPF32 = new Float32Array(buf);
  Module["HEAPF64"] = HEAPF64 = new Float64Array(buf)
}
var DYNAMIC_BASE = 31142784,
  DYNAMICTOP_PTR = 30094e3;
var INITIAL_TOTAL_MEMORY = Module["TOTAL_MEMORY"] || 67108864;
if (Module["wasmMemory"]) {
  wasmMemory = Module["wasmMemory"]
} else {
  wasmMemory = new WebAssembly.Memory({
    "initial": INITIAL_TOTAL_MEMORY / WASM_PAGE_SIZE
  })
}
if (wasmMemory) {
  buffer = wasmMemory.buffer
}
INITIAL_TOTAL_MEMORY = buffer.byteLength;
updateGlobalBufferAndViews(buffer);
HEAP32[DYNAMICTOP_PTR >> 2] = DYNAMIC_BASE;

function callRuntimeCallbacks(callbacks) {
  while (callbacks.length > 0) {
    var callback = callbacks.shift();
    if (typeof callback == "function") {
      callback();
      continue
    }
    var func = callback.func;
    if (typeof func === "number") {
      if (callback.arg === undefined) {
        Module["dynCall_v"](func)
      } else {
        Module["dynCall_vi"](func, callback.arg)
      }
    } else {
      func(callback.arg === undefined ? null : callback.arg)
    }
  }
}
var __ATPRERUN__ = [];
var __ATINIT__ = [];
var __ATMAIN__ = [];
var __ATEXIT__ = [];
var __ATPOSTRUN__ = [];
var runtimeInitialized = false;
var runtimeExited = false;

function preRun() {
  if (Module["preRun"]) {
    if (typeof Module["preRun"] == "function") Module["preRun"] = [Module["preRun"]];
    while (Module["preRun"].length) {
      addOnPreRun(Module["preRun"].shift())
    }
  }
  callRuntimeCallbacks(__ATPRERUN__)
}

function initRuntime() {
  runtimeInitialized = true;
  if (!Module["noFSInit"] && !FS.init.initialized) FS.init();
  TTY.init();
  callRuntimeCallbacks(__ATINIT__)
}

function preMain() {
  FS.ignorePermissions = false;
  callRuntimeCallbacks(__ATMAIN__)
}

function exitRuntime() {
  runtimeExited = true
}

function postRun() {
  if (Module["postRun"]) {
    if (typeof Module["postRun"] == "function") Module["postRun"] = [Module["postRun"]];
    while (Module["postRun"].length) {
      addOnPostRun(Module["postRun"].shift())
    }
  }
  callRuntimeCallbacks(__ATPOSTRUN__)
}

function addOnPreRun(cb) {
  __ATPRERUN__.unshift(cb)
}

function addOnPostRun(cb) {
  __ATPOSTRUN__.unshift(cb)
}
var Math_abs = Math.abs;
var Math_ceil = Math.ceil;
var Math_floor = Math.floor;
var Math_min = Math.min;
var runDependencies = 0;
var runDependencyWatcher = null;
var dependenciesFulfilled = null;

function getUniqueRunDependency(id) {
  return id
}

function addRunDependency(id) {
  runDependencies++;
  if (Module["monitorRunDependencies"]) {
    Module["monitorRunDependencies"](runDependencies)
  }
}

function removeRunDependency(id) {
  runDependencies--;
  if (Module["monitorRunDependencies"]) {
    Module["monitorRunDependencies"](runDependencies)
  }
  if (runDependencies == 0) {
    if (runDependencyWatcher !== null) {
      clearInterval(runDependencyWatcher);
      runDependencyWatcher = null
    }
    if (dependenciesFulfilled) {
      postMessage({target: 'ready'});
      var callback = dependenciesFulfilled;
      dependenciesFulfilled = null;
      callback()
    }
  }
}
Module["preloadedImages"] = {};
Module["preloadedAudios"] = {};

function abort(what) {
  if (Module["onAbort"]) {
    Module["onAbort"](what)
  }
  what += "";
  out(what);
  err(what);
  ABORT = true;
  EXITSTATUS = 1;
  throw "abort(" + what + "). Build with -s ASSERTIONS=1 for more info."
}
var dataURIPrefix = "data:application/octet-stream;base64,";

function isDataURI(filename) {
  return String.prototype.startsWith ? filename.startsWith(dataURIPrefix) : filename.indexOf(dataURIPrefix) === 0
}
var wasmBinaryFile = "wdosbox-emterp.wasm";
if (!isDataURI(wasmBinaryFile)) {
  wasmBinaryFile = locateFile(wasmBinaryFile)
}

function getBinary() {
  try {
    if (wasmBinary) {
      return new Uint8Array(wasmBinary)
    }
    if (readBinary) {
      return readBinary(wasmBinaryFile)
    } else {
      throw "both async and sync fetching of the wasm failed"
    }
  } catch (err) {
    abort(err)
  }
}

function getBinaryPromise() {
  if (!wasmBinary && (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) && typeof fetch === "function") {
    return fetch(wasmBinaryFile, {
      credentials: "same-origin"
    }).then(function (response) {
      if (!response["ok"]) {
        throw "failed to load wasm binary file at '" + wasmBinaryFile + "'"
      }
      return response["arrayBuffer"]()
    }).catch(function () {
      return getBinary()
    })
  }
  return new Promise(function (resolve, reject) {
    resolve(getBinary())
  })
}

function createWasm() {

  var info = {
    "env": asmLibraryArg,
    "wasi_unstable": asmLibraryArg,
    "global": {
      "NaN": NaN,
      Infinity: Infinity
    },
    "global.Math": Math,
    "asm2wasm": asm2wasmImports
  };

  function receiveInstance(instance, module) {
    var exports = instance.exports;
    Module["asm"] = exports;
    removeRunDependency("wasm-instantiate")
  }
  addRunDependency("wasm-instantiate");

  function receiveInstantiatedSource(output) {
    receiveInstance(output["instance"])
  }

  function instantiateArrayBuffer(receiver) {
    return getBinaryPromise().then(function (binary) {
      return WebAssembly.instantiate(binary, info)
    }).then(receiver, function (reason) {
      err("failed to asynchronously prepare wasm: " + reason);
      abort(reason)
    })
  }

  function instantiateAsync() {
    if (!wasmBinary && typeof WebAssembly.instantiateStreaming === "function" && !isDataURI(wasmBinaryFile) && typeof fetch === "function") {
      fetch(wasmBinaryFile, {
        credentials: "same-origin"
      }).then(function (response) {
        var result = WebAssembly.instantiateStreaming(response, info);
        return result.then(receiveInstantiatedSource, function (reason) {
          err("wasm streaming compile failed: " + reason);
          err("falling back to ArrayBuffer instantiation");
          instantiateArrayBuffer(receiveInstantiatedSource)
        })
      })
    } else {
      return instantiateArrayBuffer(receiveInstantiatedSource)
    }
  }
  if (Module["instantiateWasm"]) {
    try {
      var exports = Module["instantiateWasm"](info, receiveInstance);
      return exports
    } catch (e) {
      err("Module.instantiateWasm callback failed with error: " + e);
      return false
    }
  }
  instantiateAsync();
  return {}
}
Module["asm"] = createWasm;
var tempDouble;
var tempI64;
var ASM_CONSTS = [function () {
  Module.sync_id = Date.now();
  Module.sync_sleep = function (wakeUp) {
    if (Module.sync_wakeUp) {
      throw new Error("Trying to sleep in sleeping state!");
      return
    }
    Module.sync_wakeUp = wakeUp;
    window.postMessage({
      type: "sync_sleep_message",
      id: Module.sync_id
    }, "*")
  };
  Module.receive = function (ev) {
    if (ev.source !== window) {
      return
    }
    var data = ev.data;
    if (ev.data.type === "sync_sleep_message" && Module.sync_id == ev.data.id) {
      ev.stopPropagation();
      var wakeUp = Module.sync_wakeUp;
      delete Module.sync_wakeUp;
      wakeUp()
    }
  };
  window.addEventListener("message", Module.receive, true)
}, function () {
  window.removeEventListener("message", Module.receive);
  delete Module.sync_sleep
}, function () {
  return EmterpreterAsync.state === 0 ? 1 : 0
}, function () {
  if (Module.heapOperation !== undefined) {
    Module.heapOperation();
    return 1
  }
  return 0
}, function () {
  if (SDL && SDL.audio && SDL.audio.queueNewAudioData) {
    SDL.audio.queueNewAudioData()
  }
}, function () {
  Module["SDL"] = SDL;
  Module["canvas"].addEventListener("touchstart", function (event) { }, true);
  Module["canvas"].addEventListener("touchmove", function (event) {
    event.preventDefault()
  }, true);
  var fixSounds = function (event) {
    if (SDL && SDL.audioContext && SDL.audioContext.state) {
      if (SDL.audioContext.state !== "running") {
        SDL.audioContext.resume()
      }
    }
  };
  window.addEventListener("touchstart", fixSounds, true);
  window.addEventListener("mousedown", fixSounds, true)
}, function ($0, $1) {
  var clfield = UTF8ToString($0);
  var innerobj = UTF8ToString($1);
  if (innerobj.length > 0) {
    innerobj = innerobj.slice(0, -1)
  }
  var object = JSON.parse("{" + innerobj + "}");
  if (clfield in Module) {
    Module[clfield](object);
    delete Module[clfield]
  }
}, function () {
  Module["send"] = function (key, data, callback) {
    if (!callback) {
      callback = function () { }
    }
    if (!data) {
      data = ""
    }
    var clfield = key + "_callback_" + Math.random();
    var keyLength = Module["lengthBytesUTF8"](key) + 1;
    var clfieldLength = Module["lengthBytesUTF8"](clfield) + 1;
    var dataLength = Module["lengthBytesUTF8"](data) + 1;
    var clfieldBuffer = Module["_malloc"](clfieldLength);
    var keyBuffer = Module["_malloc"](keyLength);
    var dataBuffer = Module["_malloc"](dataLength);
    Module["stringToUTF8"](key, keyBuffer, keyLength);
    Module["stringToUTF8"](clfield, clfieldBuffer, clfieldLength);
    Module["stringToUTF8"](data, dataBuffer, dataLength);
    Module[clfield] = callback;
    Module["__send"](keyBuffer, dataBuffer, clfieldBuffer);
    Module["_free"](keyBuffer);
    Module["_free"](clfieldBuffer);
    Module["_free"](dataBuffer)
  }
}, function ($0) {
  const event = UTF8ToString($0);
  Module["ping"](event)
}, function () {
  if (navigator.userAgent.toLowerCase().indexOf("firefox") > -1) {
    return 0
  }
  return 1
}, function ($0) {
  const callbackName = UTF8ToString($0);
  Module["screenshot_callback_name"] = callbackName
}, function () {
  if (!Module["screenshot_callback_name"]) {
    return
  }
  const callbackName = Module["screenshot_callback_name"];
  const imgData = Module["canvas"].toDataURL("image/png");
  const callback = Module[callbackName];
  delete Module[callbackName];
  delete Module["screenshot_callback_name"];
  callback(imgData)
}, function ($0, $1) {
  Module["ping"]("shell_input", $0, $1)
}, function ($0, $1) {
  const data = UTF8ToString($0, $1);
  Module["ping"]("write_stdout", data)
}, function ($0) {
  const version = Module["version"];
  let versionLength = Module["lengthBytesUTF8"](version) + 1;
  if (versionLength > 256) {
    versionLength = 256
  }
  Module["stringToUTF8"](version, $0, versionLength)
}, function () {
  Module["screenIsReadOnly"] = true;
  var canvasStyle = Module["canvas"].style;
  canvasStyle.imageRendering = "optimizeSpeed";
  canvasStyle.imageRendering = "-moz-crisp-edges";
  canvasStyle.imageRendering = "-o-crisp-edges";
  canvasStyle.imageRendering = "-webkit-optimize-contrast";
  canvasStyle.imageRendering = "optimize-contrast";
  canvasStyle.imageRendering = "crisp-edges";
  canvasStyle.imageRendering = "pixelated"
}];

function _emscripten_asm_const_iii(code, a0, a1) {
  return ASM_CONSTS[code](a0, a1)
}

function _emscripten_asm_const_i(code) {
  return ASM_CONSTS[code]()
}

function _emscripten_asm_const_ii(code, a0) {
  return ASM_CONSTS[code](a0)
}
__ATINIT__.push({
  func: function () {
    __GLOBAL__sub_I_js_dos_asyncify_cpp()
  }
}, {
  func: function () {
    __GLOBAL__sub_I_cpu_cpp()
  }
}, {
  func: function () {
    __GLOBAL__sub_I_drives_cpp()
  }
}, {
  func: function () {
    __GLOBAL__sub_I_shell_misc_cpp()
  }
}, {
  func: function () {
    __GLOBAL__sub_I_sdl_mapper_cpp()
  }
}, {
  func: function () {
    __GLOBAL__sub_I_hardware_cpp()
  }
}, {
  func: function () {
    __GLOBAL__sub_I_programs_cpp()
  }
}, {
  func: function () {
    __GLOBAL__sub_I_setup_cpp()
  }
}, {
  func: function () {
    ___emscripten_environ_constructor()
  }
});
var tempDoublePtr = 30094192;
var EMTSTACKTOP = getMemory(1048576);
var EMT_STACK_MAX = EMTSTACKTOP + 1048576;
var eb = getMemory(84712);
__ATPRERUN__.push(function () {
  HEAPU8.set([140, 0, 69, 0, 0, 0, 0, 0, 2, 55, 0, 0, 200, 68, 118, 1, 2, 56, 0, 0, 100, 34, 187, 0, 2, 57, 0, 0, 104, 34, 187, 0, 2, 58, 0, 0, 255, 0, 0, 0, 2, 59, 0, 0, 73, 36, 187, 0, 2, 60, 0, 0, 102, 34, 187, 0, 1, 49, 0, 0, 136, 61, 0, 0, 0, 54, 61, 0, 136, 61, 0, 0, 1, 62, 144, 6, 3, 61, 61, 62, 137, 61, 0, 0, 1, 61, 80, 6, 3, 45, 54, 61, 1, 61, 72, 6, 3, 46, 54, 61, 1, 61, 64, 6, 3, 47, 54, 61, 1, 61, 56, 6, 3, 41, 54, 61, 1, 61, 48, 6, 3, 40, 54, 61, 1, 61, 40, 6, 3, 51, 54, 61, 1, 61, 32, 6, 3, 39, 54, 61, 1, 61, 96, 6, 3, 53, 54, 61, 1, 61, 16, 5, 3, 2, 54, 61, 1, 61, 0, 4, 3, 3, 54, 61, 0, 52, 54, 0, 1, 61, 104, 6, 3, 50, 54, 61, 1, 61, 142, 6, 3, 5, 54, 61, 1, 61, 141, 6, 3, 8, 54, 61, 1, 61, 140, 6, 3, 9, 54, 61, 1, 61, 139, 6, 3, 10, 54, 61, 1, 61, 138, 6, 3, 11, 54, 61, 1, 61, 137, 6, 3, 12, 54, 61, 1, 61, 136, 6, 3, 13, 54, 61, 1, 61, 135, 6, 3, 14, 54, 61, 1, 61, 134, 6, 3, 15, 54, 61, 1, 61, 133, 6, 3, 16, 54, 61, 1, 61, 132, 6, 3, 17, 54, 61, 1, 61, 131, 6, 3, 18, 54, 61, 1, 61, 130, 6, 3, 19, 54, 61, 1, 61, 88, 6, 3, 20, 54, 61, 1, 61, 129, 6, 3, 21, 54, 61, 1, 61, 128, 6, 3, 44, 54, 61, 1, 61, 127, 6, 3, 22, 54, 61, 1, 61, 126, 6, 3, 23, 54, 61, 1, 61, 117, 6, 3, 4, 54, 61, 1, 61, 125, 6, 3, 24, 54, 61, 1, 61, 124, 6, 3, 25, 54, 61, 1, 61, 123, 6, 3, 26, 54, 61, 1, 61, 122, 6, 3, 27, 54, 61, 1, 61, 121, 6, 3, 28, 54, 61, 1, 61, 120, 6, 3, 29, 54, 61, 1, 61, 119, 6, 3, 30, 54, 61, 1, 61, 118, 6, 3, 31, 54, 61, 1, 61, 116, 6, 3, 32, 54, 61, 1, 61, 115, 6, 3, 33, 54, 61, 1, 61, 114, 6, 3, 34, 54, 61, 1, 61, 113, 6, 3, 35, 54, 61, 1, 61, 112, 6, 3, 36, 54, 61, 1, 61, 111, 6, 3, 37, 54, 61, 1, 61, 110, 6, 3, 38, 54, 61, 1, 61, 109, 6, 3, 43, 54, 61, 1, 61, 108, 6, 3, 42, 54, 61, 1, 61, 107, 6, 3, 6, 54, 61, 1, 61, 106, 6, 3, 7, 54, 61, 2, 61, 0, 0, 201, 68, 118, 1, 78, 0, 61, 0, 41, 61, 0, 24, 42, 61, 61, 24, 1, 62, 80, 0, 1, 63, 21, 0, 138, 61, 62, 63, 200, 2, 0, 0, 208, 2, 0, 0, 84, 2, 0, 0, 84, 2, 0, 0, 84, 2, 0, 0, 84, 2, 0, 0, 84, 2, 0, 0, 84, 2, 0, 0, 84, 2, 0, 0, 84, 2, 0, 0, 84, 2, 0, 0, 84, 2, 0, 0, 84, 2, 0, 0, 84, 2, 0, 0, 84, 2, 0, 0, 84, 2, 0, 0, 84, 2, 0, 0, 84, 2, 0, 0, 212, 2, 0, 0, 84, 2, 0, 0, 216, 2, 0, 0, 19, 62, 0, 58, 34, 62, 62, 108, 121, 62, 25, 0, 2, 64, 0, 0, 136, 72, 118, 1, 135, 63, 0, 0, 64, 0, 0, 0, 135, 62, 1, 0, 53, 63, 0, 0, 2, 63, 0, 0, 140, 69, 118, 1, 81, 63, 63, 0, 41, 63, 63, 16, 2, 64, 0, 0, 216, 68, 118, 1, 80, 64, 64, 0, 26, 64, 64, 18, 2, 65, 0, 0, 255, 255, 0, 0, 19, 64, 64, 65, 20, 63, 63, 64, 135, 62, 2, 0, 53, 63, 0, 0, 2, 62, 0, 0, 201, 68, 118, 1, 78, 1, 62, 0, 119, 0, 8, 0, 0, 1, 0, 0, 119, 0, 6, 0, 0, 1, 0, 0, 119, 0, 4, 0, 119, 0, 254, 255, 119, 0, 253, 255, 119, 0, 252, 255, 19, 61, 1, 58, 0, 0, 61, 0, 41, 61, 1, 24, 42, 61, 61, 24, 1, 66, 0, 0, 1, 65, 114, 0, 138, 61, 66, 65, 16, 5, 0, 0, 76, 5, 0, 0, 148, 5, 0, 0, 224, 5, 0, 0, 80, 6, 0, 0, 220, 6, 0, 0, 244, 6, 0, 0, 176, 7, 0, 0, 216, 7, 0, 0, 0, 8, 0, 0, 100, 8, 0, 0, 76, 10, 0, 0, 104, 10, 0, 0, 140, 11, 0, 0, 144, 11, 0, 0, 176, 11, 0, 0, 16, 12, 0, 0, 112, 12, 0, 0, 208, 12, 0, 0, 48, 13, 0, 0, 144, 13, 0, 0, 228, 13, 0, 0, 56, 14, 0, 0, 152, 14, 0, 0, 192, 4, 0, 0, 212, 14, 0, 0, 224, 14, 0, 0, 20, 15, 0, 0, 64, 15, 0, 0, 192, 4, 0, 0, 192, 4, 0, 0, 116, 15, 0, 0, 192, 4, 0, 0, 76, 16, 0, 0, 168, 16, 0, 0, 4, 17, 0, 0, 64, 17, 0, 0, 100, 17, 0, 0, 152, 17, 0, 0, 216, 17, 0, 0, 52, 18, 0, 0, 144, 18, 0, 0, 48, 19, 0, 0, 24, 20, 0, 0, 28, 21, 0, 0, 32, 22, 0, 0, 28, 23, 0, 0, 56, 23, 0, 0, 156, 23, 0, 0, 48, 24, 0, 0, 116, 24, 0, 0, 120, 24, 0, 0, 244, 25, 0, 0, 40, 26, 0, 0, 132, 26, 0, 0, 252, 26, 0, 0, 148, 27, 0, 0, 40, 28, 0, 0, 148, 28, 0, 0, 48, 29, 0, 0, 156, 29, 0, 0, 16, 30, 0, 0, 124, 30, 0, 0, 200, 30, 0, 0, 148, 31, 0, 0, 68, 32, 0, 0, 168, 32, 0, 0, 52, 33, 0, 0, 132, 34, 0, 0, 188, 34, 0, 0, 4, 35, 0, 0, 104, 35, 0, 0, 232, 35, 0, 0, 76, 36, 0, 0, 148, 36, 0, 0, 12, 37, 0, 0, 168, 37, 0, 0, 204, 37, 0, 0, 248, 37, 0, 0, 116, 38, 0, 0, 180, 38, 0, 0, 212, 38, 0, 0, 244, 38, 0, 0, 88, 39, 0, 0, 112, 39, 0, 0, 132, 39, 0, 0, 204, 39, 0, 0, 88, 40, 0, 0, 20, 41, 0, 0, 44, 42, 0, 0, 140, 42, 0, 0, 40, 43, 0, 0, 244, 43, 0, 0, 32, 44, 0, 0, 192, 4, 0, 0, 160, 44, 0, 0, 184, 44, 0, 0, 192, 4, 0, 0, 76, 45, 0, 0, 108, 45, 0, 0, 212, 45, 0, 0, 248, 45, 0, 0, 132, 50, 0, 0, 8, 51, 0, 0, 68, 51, 0, 0, 140, 51, 0, 0, 192, 4, 0, 0, 192, 4, 0, 0, 36, 52, 0, 0, 192, 4, 0, 0, 192, 4, 0, 0, 192, 4, 0, 0, 192, 4, 0, 0, 184, 52, 0, 0, 19, 66, 1, 58, 34, 66, 66, 109, 121, 66, 15, 0, 1, 62, 14, 0, 1, 64, 2, 0, 135, 66, 3, 0, 7, 62, 64, 0, 2, 64, 0, 0, 17, 223, 3, 0, 2, 62, 0, 0, 201, 68, 118, 1, 79, 62, 62, 0, 76, 62, 62, 0, 79, 65, 55, 0, 76, 65, 65, 0, 135, 66, 4, 0, 7, 64, 62, 65, 1, 66, 0, 0, 83, 55, 66, 0, 119, 0, 251, 11, 2, 64, 0, 0, 160, 69, 118, 1, 82, 64, 64, 0, 25, 64, 64, 2, 2, 65, 0, 0, 216, 68, 118, 1, 81, 65, 65, 0, 3, 64, 64, 65, 135, 63, 5, 0, 64, 0, 0, 0, 1, 64, 0, 0, 1, 65, 0, 0, 135, 62, 6, 0, 63, 64, 65, 0, 119, 0, 236, 11, 1, 62, 1, 0, 84, 52, 62, 0, 2, 62, 0, 0, 161, 72, 118, 1, 1, 65, 1, 0, 83, 62, 65, 0, 1, 62, 0, 0, 1, 64, 0, 0, 134, 65, 0, 0, 4, 58, 1, 0, 62, 53, 52, 64, 78, 65, 53, 0, 83, 55, 65, 0, 2, 65, 0, 0, 161, 72, 118, 1, 1, 64, 0, 0, 83, 65, 64, 0, 119, 0, 218, 11, 2, 64, 0, 0, 208, 68, 118, 1, 78, 64, 64, 0, 83, 53, 64, 0, 1, 64, 1, 0, 84, 52, 64, 0, 1, 65, 1, 0, 1, 62, 0, 0, 135, 64, 7, 0, 65, 53, 52, 62, 78, 53, 53, 0, 41, 62, 53, 24, 42, 62, 62, 24, 32, 62, 62, 9, 1, 65, 32, 0, 125, 64, 62, 65, 53, 0, 0, 0, 83, 55, 64, 0, 119, 0, 199, 11, 1, 64, 0, 4, 135, 0, 5, 0, 64, 0, 0, 0, 41, 64, 0, 16, 42, 64, 64, 16, 32, 64, 64, 0, 2, 65, 0, 0, 0, 245, 50, 0, 82, 65, 65, 0, 32, 65, 65, 0, 20, 64, 64, 65, 120, 64, 187, 11, 2, 65, 0, 0, 255, 255, 0, 0, 19, 65, 0, 65, 25, 65, 65, 4, 1, 62, 3, 0, 135, 64, 8, 0, 65, 62, 0, 0, 2, 62, 0, 0, 0, 245, 50, 0, 82, 62, 62, 0, 1, 65, 1, 0, 1, 63, 255, 255, 135, 64, 9, 0, 62, 55, 53, 65, 63, 0, 0, 0, 119, 0, 171, 11, 1, 64, 0, 4, 135, 0, 5, 0, 64, 0, 0, 0, 41, 64, 0, 16, 42, 64, 64, 16, 32, 64, 64, 0, 2, 63, 0, 0, 0, 245, 50, 0, 82, 63, 63, 0, 32, 63, 63, 0, 20, 64, 64, 63, 120, 64, 159, 11, 2, 64, 0, 0, 255, 255, 0, 0, 19, 64, 0, 64, 25, 53, 64, 4, 1, 63, 3, 0, 135, 64, 8, 0, 53, 63, 0, 0, 2, 63, 0, 0, 0, 245, 50, 0, 82, 63, 63, 0, 2, 65, 0, 0, 208, 68, 118, 1, 78, 65, 65, 0, 1, 62, 1, 0, 1, 66, 1, 0, 1, 67, 255, 255, 135, 64, 10, 0, 63, 65, 62, 66, 67, 0, 0, 0, 1, 67, 1, 0, 135, 64, 8, 0, 53, 67, 0, 0, 119, 0, 136, 11, 85, 39, 0, 0, 2, 67, 0, 0, 232, 216, 3, 0, 135, 64, 11, 0, 67, 39, 0, 0, 119, 0, 130, 11, 2, 64, 0, 0, 208, 68, 118, 1, 78, 0, 64, 0, 41, 64, 0, 24, 42, 64, 64, 24, 33, 64, 64, 255, 121, 64, 19, 0, 83, 53, 0, 0, 1, 64, 1, 0, 84, 52, 64, 0, 2, 64, 0, 0, 162, 72, 118, 1, 1, 67, 1, 0, 83, 64, 67, 0, 1, 64, 1, 0, 1, 66, 0, 0, 135, 67, 7, 0, 64, 53, 52, 66, 2, 67, 0, 0, 162, 72, 118, 1, 1, 66, 0, 0, 83, 67, 66, 0, 78, 66, 53, 0, 83, 55, 66, 0, 119, 0, 105, 11, 135, 66, 12, 0, 135, 66, 13, 0, 121, 66, 14, 0, 1, 66, 1, 0, 84, 52, 66, 0, 1, 67, 0, 0, 1, 64, 0, 0, 134, 66, 0, 0, 4, 58, 1, 0, 67, 53, 52, 64, 78, 66, 53, 0, 83, 55, 66, 0, 1, 64, 0, 0, 135, 66, 14, 0, 64, 0, 0, 0, 119, 0, 89, 11, 1, 66, 0, 0, 83, 55, 66, 0, 1, 64, 1, 0, 135, 66, 14, 0, 64, 0, 0, 0, 119, 0, 83, 11, 1, 66, 1, 0, 84, 52, 66, 0, 1, 64, 0, 0, 1, 67, 0, 0, 134, 66, 0, 0, 4, 58, 1, 0, 64, 53, 52, 67, 78, 66, 53, 0, 83, 55, 66, 0, 119, 0, 73, 11, 1, 66, 1, 0, 84, 52, 66, 0, 1, 67, 0, 0, 1, 64, 0, 0, 134, 66, 0, 0, 4, 58, 1, 0, 67, 53, 52, 64, 78, 66, 53, 0, 83, 55, 66, 0, 119, 0, 63, 11, 1, 66, 1, 0, 84, 52, 66, 0, 2, 66, 0, 0, 164, 69, 118, 1, 82, 66, 66, 0, 2, 64, 0, 0, 208, 68, 118, 1, 81, 64, 64, 0, 3, 0, 66, 64, 135, 51, 15, 0, 0, 0, 0, 0, 83, 53, 51, 0, 41, 64, 51, 24, 42, 64, 64, 24, 32, 64, 64, 36, 120, 64, 7, 0, 1, 66, 1, 0, 1, 67, 0, 0, 135, 64, 7, 0, 66, 53, 52, 67, 25, 0, 0, 1, 119, 0, 244, 255, 1, 64, 36, 0, 83, 55, 64, 0, 119, 0, 38, 11, 2, 64, 0, 0, 164, 69, 118, 1, 82, 64, 64, 0, 2, 67, 0, 0, 208, 68, 118, 1, 81, 67, 67, 0, 3, 5, 64, 67, 135, 0, 15, 0, 5, 0, 0, 0, 1, 67, 1, 0, 84, 52, 67, 0, 41, 67, 0, 24, 42, 67, 67, 24, 121, 67, 24, 11, 26, 67, 0, 1, 41, 67, 67, 24, 42, 67, 67, 24, 0, 4, 67, 0, 25, 3, 5, 2, 1, 0, 0, 0, 41, 67, 0, 24, 42, 67, 67, 24, 41, 64, 4, 24, 42, 64, 64, 24, 14, 2, 67, 64, 1, 67, 0, 0, 1, 66, 0, 0, 134, 64, 0, 0, 4, 58, 1, 0, 67, 53, 52, 66, 80, 64, 52, 0, 120, 64, 3, 0, 1, 49, 28, 0, 119, 0, 76, 0, 78, 1, 53, 0, 41, 64, 1, 24, 42, 64, 64, 24, 1, 66, 8, 0, 1, 62, 3, 0, 138, 64, 66, 62, 72, 9, 0, 0, 16, 9, 0, 0, 80, 9, 0, 0, 41, 66, 1, 24, 42, 66, 66, 24, 32, 66, 66, 13, 20, 66, 2, 66, 121, 66, 3, 0, 1, 49, 36, 0, 119, 0, 11, 0, 1, 66, 7, 0, 83, 50, 66, 0, 1, 67, 1, 0, 1, 62, 0, 0, 135, 66, 7, 0, 67, 50, 52, 62, 119, 0, 225, 255, 1, 49, 31, 0, 119, 0, 2, 0, 119, 0, 222, 255, 32, 64, 49, 31, 121, 64, 27, 0, 41, 64, 0, 24, 42, 64, 64, 24, 120, 64, 3, 0, 1, 0, 0, 0, 119, 0, 210, 255, 1, 66, 1, 0, 1, 62, 0, 0, 135, 64, 7, 0, 66, 53, 52, 62, 1, 64, 32, 0, 83, 53, 64, 0, 1, 62, 1, 0, 1, 66, 0, 0, 135, 64, 7, 0, 62, 53, 52, 66, 1, 64, 8, 0, 83, 53, 64, 0, 1, 66, 1, 0, 1, 62, 0, 0, 135, 64, 7, 0, 66, 53, 52, 62, 26, 64, 0, 1, 41, 64, 64, 24, 42, 64, 64, 24, 0, 0, 64, 0, 119, 0, 189, 255, 32, 64, 49, 36, 121, 64, 187, 255, 1, 62, 1, 0, 1, 66, 0, 0, 135, 64, 7, 0, 62, 53, 52, 66, 19, 66, 0, 58, 3, 66, 3, 66, 78, 62, 53, 0, 135, 64, 16, 0, 66, 62, 0, 0, 78, 64, 53, 0, 32, 64, 64, 13, 121, 64, 3, 0, 1, 49, 38, 0, 119, 0, 6, 0, 25, 64, 0, 1, 41, 64, 64, 24, 42, 64, 64, 24, 0, 0, 64, 0, 119, 0, 168, 255, 32, 64, 49, 28, 121, 64, 6, 0, 2, 62, 0, 0, 0, 217, 3, 0, 135, 64, 11, 0, 62, 51, 0, 0, 119, 0, 178, 10, 32, 64, 49, 38, 121, 64, 176, 10, 25, 62, 5, 1, 135, 64, 16, 0, 62, 0, 0, 0, 119, 0, 172, 10, 135, 64, 13, 0, 41, 64, 64, 31, 42, 64, 64, 31, 0, 53, 64, 0, 83, 55, 53, 0, 135, 64, 12, 0, 119, 0, 165, 10, 2, 66, 0, 0, 136, 72, 118, 1, 135, 62, 0, 0, 66, 0, 0, 0, 135, 64, 1, 0, 53, 62, 0, 0, 1, 64, 0, 0, 135, 0, 17, 0, 53, 64, 0, 0, 41, 64, 0, 24, 42, 64, 64, 24, 33, 64, 64, 255, 121, 64, 26, 0, 2, 64, 0, 0, 96, 213, 8, 0, 19, 62, 0, 58, 41, 62, 62, 2, 94, 0, 64, 62, 121, 0, 20, 0, 82, 62, 0, 0, 106, 62, 62, 40, 19, 62, 62, 58, 2, 66, 0, 0, 130, 254, 3, 0, 135, 64, 18, 0, 62, 0, 66, 0, 121, 64, 12, 0, 135, 64, 13, 0, 120, 64, 2, 0, 119, 0, 9, 0, 1, 64, 1, 0, 84, 52, 64, 0, 1, 62, 0, 0, 1, 66, 0, 0, 134, 64, 0, 0, 4, 58, 1, 0, 62, 53, 52, 66, 119, 0, 246, 255, 78, 0, 55, 0, 41, 64, 0, 24, 42, 64, 64, 24, 1, 66, 1, 0, 1, 62, 10, 0, 138, 64, 66, 62, 76, 11, 0, 0, 64, 11, 0, 0, 64, 11, 0, 0, 64, 11, 0, 0, 64, 11, 0, 0, 124, 11, 0, 0, 128, 11, 0, 0, 132, 11, 0, 0, 64, 11, 0, 0, 136, 11, 0, 0, 1, 66, 0, 0, 83, 55, 66, 0, 119, 0, 108, 10, 2, 66, 0, 0, 201, 68, 118, 1, 78, 53, 66, 0, 2, 66, 0, 0, 201, 68, 118, 1, 83, 66, 0, 0, 134, 66, 0, 0, 0, 0, 0, 0, 2, 66, 0, 0, 201, 68, 118, 1, 83, 66, 53, 0, 119, 0, 96, 10, 119, 0, 244, 255, 119, 0, 243, 255, 119, 0, 242, 255, 119, 0, 241, 255, 119, 0, 91, 10, 2, 66, 0, 0, 208, 68, 118, 1, 78, 66, 66, 0, 135, 64, 19, 0, 66, 0, 0, 0, 1, 64, 26, 0, 83, 55, 64, 0, 119, 0, 83, 10, 2, 66, 0, 0, 142, 69, 118, 1, 80, 66, 66, 0, 2, 62, 0, 0, 208, 68, 118, 1, 80, 62, 62, 0, 135, 64, 20, 0, 66, 62, 0, 0, 40, 64, 64, 1, 41, 64, 64, 31, 42, 64, 64, 31, 0, 53, 64, 0, 83, 55, 53, 0, 1, 62, 10, 0, 1, 66, 0, 0, 135, 64, 3, 0, 5, 62, 66, 0, 2, 66, 0, 0, 38, 217, 3, 0, 79, 62, 55, 0, 76, 62, 62, 0, 135, 64, 21, 0, 5, 66, 62, 0, 119, 0, 59, 10, 2, 62, 0, 0, 142, 69, 118, 1, 80, 62, 62, 0, 2, 66, 0, 0, 208, 68, 118, 1, 80, 66, 66, 0, 135, 64, 22, 0, 62, 66, 0, 0, 40, 64, 64, 1, 41, 64, 64, 31, 42, 64, 64, 31, 0, 53, 64, 0, 83, 55, 53, 0, 1, 66, 10, 0, 1, 62, 0, 0, 135, 64, 3, 0, 8, 66, 62, 0, 2, 62, 0, 0, 79, 217, 3, 0, 79, 66, 55, 0, 76, 66, 66, 0, 135, 64, 21, 0, 8, 62, 66, 0, 119, 0, 35, 10, 2, 66, 0, 0, 142, 69, 118, 1, 80, 66, 66, 0, 2, 62, 0, 0, 208, 68, 118, 1, 80, 62, 62, 0, 135, 64, 23, 0, 66, 62, 0, 0, 40, 64, 64, 1, 41, 64, 64, 31, 42, 64, 64, 31, 0, 53, 64, 0, 83, 55, 53, 0, 1, 62, 10, 0, 1, 66, 0, 0, 135, 64, 3, 0, 9, 62, 66, 0, 2, 66, 0, 0, 121, 217, 3, 0, 79, 62, 55, 0, 76, 62, 62, 0, 135, 64, 21, 0, 9, 66, 62, 0, 119, 0, 11, 10, 2, 62, 0, 0, 142, 69, 118, 1, 80, 62, 62, 0, 2, 66, 0, 0, 208, 68, 118, 1, 80, 66, 66, 0, 135, 64, 24, 0, 62, 66, 0, 0, 40, 64, 64, 1, 41, 64, 64, 31, 42, 64, 64, 31, 0, 53, 64, 0, 83, 55, 53, 0, 1, 66, 10, 0, 1, 62, 0, 0, 135, 64, 3, 0, 10, 66, 62, 0, 2, 62, 0, 0, 163, 217, 3, 0, 79, 66, 55, 0, 76, 66, 66, 0, 135, 64, 21, 0, 10, 62, 66, 0, 119, 0, 243, 9, 2, 66, 0, 0, 142, 69, 118, 1, 80, 66, 66, 0, 2, 62, 0, 0, 208, 68, 118, 1, 80, 62, 62, 0, 135, 64, 25, 0, 66, 62, 0, 0, 40, 64, 64, 1, 41, 64, 64, 31, 42, 64, 64, 31, 0, 53, 64, 0, 83, 55, 53, 0, 1, 62, 10, 0, 1, 66, 0, 0, 135, 64, 3, 0, 11, 62, 66, 0, 2, 66, 0, 0, 204, 217, 3, 0, 79, 62, 55, 0, 76, 62, 62, 0, 135, 64, 21, 0, 11, 66, 62, 0, 119, 0, 219, 9, 2, 64, 0, 0, 142, 69, 118, 1, 80, 64, 64, 0, 2, 62, 0, 0, 208, 68, 118, 1, 80, 62, 62, 0, 1, 66, 0, 0, 135, 53, 26, 0, 64, 62, 66, 0, 83, 55, 53, 0, 1, 62, 10, 0, 1, 64, 0, 0, 135, 66, 3, 0, 12, 62, 64, 0, 2, 64, 0, 0, 243, 217, 3, 0, 79, 62, 55, 0, 76, 62, 62, 0, 135, 66, 21, 0, 12, 64, 62, 0, 119, 0, 198, 9, 2, 66, 0, 0, 142, 69, 118, 1, 80, 66, 66, 0, 2, 62, 0, 0, 208, 68, 118, 1, 80, 62, 62, 0, 1, 64, 0, 0, 135, 53, 27, 0, 66, 62, 64, 0, 83, 55, 53, 0, 1, 62, 10, 0, 1, 66, 0, 0, 135, 64, 3, 0, 13, 62, 66, 0, 2, 66, 0, 0, 24, 218, 3, 0, 79, 62, 55, 0, 76, 62, 62, 0, 135, 64, 21, 0, 13, 66, 62, 0, 119, 0, 177, 9, 2, 62, 0, 0, 142, 69, 118, 1, 80, 62, 62, 0, 2, 66, 0, 0, 208, 68, 118, 1, 80, 66, 66, 0, 135, 64, 28, 0, 62, 66, 0, 0, 40, 64, 64, 1, 41, 64, 64, 31, 42, 64, 64, 31, 0, 53, 64, 0, 83, 55, 53, 0, 1, 66, 10, 0, 1, 62, 0, 0, 135, 64, 3, 0, 14, 66, 62, 0, 2, 62, 0, 0, 62, 218, 3, 0, 79, 66, 55, 0, 76, 66, 66, 0, 135, 64, 21, 0, 14, 62, 66, 0, 119, 0, 153, 9, 2, 66, 0, 0, 142, 69, 118, 1, 80, 66, 66, 0, 2, 62, 0, 0, 208, 68, 118, 1, 80, 62, 62, 0, 135, 64, 29, 0, 66, 62, 0, 0, 121, 64, 4, 0, 1, 64, 0, 0, 83, 55, 64, 0, 119, 0, 141, 9, 1, 64, 255, 255, 83, 55, 64, 0, 119, 0, 138, 9, 135, 53, 30, 0, 83, 55, 53, 0, 119, 0, 135, 9, 2, 62, 0, 0, 136, 72, 118, 1, 2, 64, 0, 0, 142, 69, 118, 1, 81, 64, 64, 0, 41, 64, 64, 16, 2, 67, 0, 0, 208, 68, 118, 1, 81, 67, 67, 0, 20, 64, 64, 67, 135, 66, 31, 0, 62, 64, 0, 0, 119, 0, 122, 9, 1, 62, 0, 0, 2, 66, 0, 0, 204, 68, 118, 1, 2, 67, 0, 0, 208, 68, 118, 1, 135, 64, 32, 0, 62, 66, 55, 67, 120, 64, 114, 9, 1, 64, 255, 255, 83, 55, 64, 0, 119, 0, 111, 9, 2, 67, 0, 0, 208, 68, 118, 1, 78, 67, 67, 0, 2, 66, 0, 0, 204, 68, 118, 1, 2, 62, 0, 0, 208, 68, 118, 1, 135, 64, 32, 0, 67, 66, 55, 62, 120, 64, 101, 9, 1, 64, 255, 255, 83, 55, 64, 0, 119, 0, 98, 9, 2, 62, 0, 0, 208, 68, 118, 1, 78, 0, 62, 0, 41, 62, 1, 24, 42, 62, 62, 24, 32, 62, 62, 31, 41, 66, 0, 24, 42, 66, 66, 24, 32, 66, 66, 0, 20, 62, 62, 66, 121, 62, 3, 0, 135, 0, 30, 0, 119, 0, 5, 0, 26, 62, 0, 1, 41, 62, 62, 24, 42, 62, 62, 24, 0, 0, 62, 0, 2, 62, 0, 0, 96, 215, 8, 0, 19, 66, 0, 58, 41, 66, 66, 2, 94, 62, 62, 66, 120, 62, 4, 0, 1, 62, 255, 255, 83, 55, 62, 0, 119, 0, 72, 9, 1, 62, 0, 0, 83, 55, 62, 0, 2, 62, 0, 0, 196, 72, 118, 1, 80, 53, 62, 0, 2, 62, 0, 0, 142, 69, 118, 1, 84, 62, 53, 0, 2, 62, 0, 0, 164, 69, 118, 1, 2, 66, 0, 0, 255, 255, 0, 0, 19, 66, 53, 66, 41, 66, 66, 4, 85, 62, 66, 0, 2, 66, 0, 0, 212, 68, 118, 1, 19, 62, 0, 58, 84, 66, 62, 0, 1, 66, 14, 0, 1, 64, 2, 0, 135, 62, 3, 0, 44, 66, 64, 0, 2, 64, 0, 0, 160, 219, 3, 0, 135, 62, 33, 0, 44, 64, 0, 0, 119, 0, 44, 9, 1, 64, 1, 0, 84, 53, 64, 0, 2, 64, 0, 0, 142, 69, 118, 1, 80, 64, 64, 0, 2, 62, 0, 0, 208, 68, 118, 1, 80, 62, 62, 0, 1, 66, 1, 0, 135, 53, 34, 0, 64, 62, 53, 66, 83, 55, 53, 0, 1, 62, 10, 0, 1, 64, 0, 0, 135, 66, 3, 0, 15, 62, 64, 0, 2, 64, 0, 0, 101, 218, 3, 0, 79, 62, 55, 0, 76, 62, 62, 0, 135, 66, 21, 0, 15, 64, 62, 0, 119, 0, 21, 9, 1, 66, 1, 0, 84, 53, 66, 0, 2, 66, 0, 0, 142, 69, 118, 1, 80, 66, 66, 0, 2, 62, 0, 0, 208, 68, 118, 1, 80, 62, 62, 0, 1, 64, 1, 0, 135, 53, 35, 0, 66, 62, 53, 64, 83, 55, 53, 0, 1, 62, 10, 0, 1, 66, 0, 0, 135, 64, 3, 0, 16, 62, 66, 0, 2, 66, 0, 0, 145, 218, 3, 0, 79, 62, 55, 0, 76, 62, 62, 0, 135, 64, 21, 0, 16, 66, 62, 0, 119, 0, 254, 8, 2, 62, 0, 0, 142, 69, 118, 1, 80, 62, 62, 0, 2, 66, 0, 0, 208, 68, 118, 1, 80, 66, 66, 0, 135, 64, 36, 0, 62, 66, 0, 0, 121, 64, 4, 0, 1, 64, 0, 0, 83, 55, 64, 0, 119, 0, 242, 8, 1, 64, 255, 255, 83, 55, 64, 0, 119, 0, 239, 8, 2, 66, 0, 0, 142, 69, 118, 1, 80, 66, 66, 0, 2, 62, 0, 0, 208, 68, 118, 1, 80, 62, 62, 0, 135, 64, 37, 0, 66, 62, 0, 0, 119, 0, 230, 8, 79, 64, 55, 0, 41, 64, 64, 2, 2, 62, 0, 0, 142, 69, 118, 1, 81, 62, 62, 0, 41, 62, 62, 16, 2, 67, 0, 0, 208, 68, 118, 1, 81, 67, 67, 0, 20, 62, 62, 67, 135, 66, 38, 0, 64, 62, 0, 0, 119, 0, 217, 8, 2, 66, 0, 0, 208, 68, 118, 1, 80, 53, 66, 0, 2, 64, 0, 0, 136, 72, 118, 1, 135, 62, 0, 0, 64, 0, 0, 0, 135, 66, 1, 0, 20, 62, 0, 0, 135, 62, 39, 0, 20, 0, 0, 0, 135, 66, 40, 0, 53, 62, 0, 0, 1, 66, 240, 255, 83, 55, 66, 0, 119, 0, 201, 8, 2, 64, 0, 0, 142, 69, 118, 1, 80, 64, 64, 0, 2, 62, 0, 0, 208, 68, 118, 1, 80, 62, 62, 0, 2, 66, 0, 0, 204, 68, 118, 1, 1, 67, 0, 0, 135, 53, 34, 0, 64, 62, 66, 67, 83, 55, 53, 0, 1, 66, 10, 0, 1, 62, 0, 0, 135, 67, 3, 0, 17, 66, 62, 0, 2, 62, 0, 0, 190, 218, 3, 0, 79, 66, 55, 0, 76, 66, 66, 0, 135, 67, 21, 0, 17, 62, 66, 0, 119, 0, 178, 8, 2, 67, 0, 0, 142, 69, 118, 1, 80, 67, 67, 0, 2, 66, 0, 0, 208, 68, 118, 1, 80, 66, 66, 0, 2, 62, 0, 0, 204, 68, 118, 1, 1, 64, 0, 0, 135, 53, 35, 0, 67, 66, 62, 64, 83, 55, 53, 0, 1, 62, 10, 0, 1, 66, 0, 0, 135, 64, 3, 0, 18, 62, 66, 0, 2, 66, 0, 0, 241, 218, 3, 0, 79, 62, 55, 0, 76, 62, 62, 0, 135, 64, 21, 0, 18, 66, 62, 0, 119, 0, 155, 8, 2, 62, 0, 0, 164, 69, 118, 1, 82, 62, 62, 0, 2, 66, 0, 0, 224, 68, 118, 1, 81, 66, 66, 0, 3, 62, 62, 66, 1, 66, 255, 3, 135, 64, 41, 0, 62, 52, 66, 0, 2, 64, 0, 0, 136, 69, 118, 1, 80, 64, 64, 0, 2, 66, 0, 0, 228, 68, 118, 1, 80, 66, 66, 0, 78, 62, 55, 0, 135, 52, 42, 0, 64, 66, 62, 52, 53, 0, 0, 0, 83, 55, 52, 0, 2, 62, 0, 0, 224, 68, 118, 1, 2, 66, 0, 0, 224, 68, 118, 1, 81, 66, 66, 0, 79, 64, 53, 0, 3, 66, 66, 64, 84, 62, 66, 0, 1, 62, 10, 0, 1, 64, 0, 0, 135, 66, 3, 0, 19, 62, 64, 0, 2, 64, 0, 0, 37, 219, 3, 0, 79, 62, 55, 0, 76, 62, 62, 0, 135, 66, 21, 0, 19, 64, 62, 0, 119, 0, 115, 8, 1, 66, 0, 0, 84, 55, 66, 0, 1, 62, 26, 0, 134, 66, 0, 0, 28, 73, 1, 0, 62, 0, 0, 0, 78, 0, 55, 0, 41, 66, 0, 24, 42, 66, 66, 24, 121, 66, 4, 0, 19, 62, 0, 58, 135, 66, 43, 0, 62, 0, 0, 0, 2, 66, 0, 0, 138, 72, 118, 1, 78, 52, 66, 0, 19, 66, 52, 58, 0, 50, 66, 0, 1, 66, 14, 0, 4, 66, 66, 50, 28, 49, 66, 12, 2, 66, 0, 0, 136, 72, 118, 1, 80, 51, 66, 0, 2, 66, 0, 0, 255, 255, 0, 0, 19, 66, 51, 66, 4, 48, 66, 49, 2, 66, 0, 0, 139, 72, 118, 1, 78, 53, 66, 0, 19, 66, 53, 58, 3, 66, 48, 66, 28, 62, 48, 4, 3, 66, 66, 62, 28, 62, 48, 156, 3, 66, 66, 62, 1, 62, 144, 1, 6, 62, 48, 62, 3, 66, 66, 62, 27, 62, 49, 12, 3, 62, 62, 50, 27, 62, 62, 31, 26, 62, 62, 62, 28, 62, 62, 12, 3, 66, 66, 62, 30, 66, 66, 7, 83, 55, 66, 0, 2, 66, 0, 0, 204, 68, 118, 1, 84, 66, 51, 0, 2, 66, 0, 0, 209, 68, 118, 1, 83, 66, 52, 0, 2, 66, 0, 0, 208, 68, 118, 1, 83, 66, 53, 0, 119, 0, 57, 8, 2, 66, 0, 0, 204, 68, 118, 1, 80, 0, 66, 0, 2, 66, 0, 0, 255, 255, 0, 0, 19, 66, 0, 66, 1, 62, 188, 7, 47, 66, 66, 62, 72, 20, 0, 0, 1, 66, 255, 255, 83, 55, 66, 0, 119, 0, 45, 8, 2, 66, 0, 0, 209, 68, 118, 1, 78, 1, 66, 0, 1, 66, 11, 0, 26, 62, 1, 1, 19, 62, 62, 58, 47, 66, 66, 62, 116, 20, 0, 0, 1, 66, 255, 255, 83, 55, 66, 0, 119, 0, 34, 8, 2, 66, 0, 0, 208, 68, 118, 1, 78, 2, 66, 0, 41, 66, 2, 24, 42, 66, 66, 24, 120, 66, 4, 0, 1, 66, 255, 255, 83, 55, 66, 0, 119, 0, 25, 8, 2, 66, 0, 0, 77, 219, 3, 0, 19, 62, 1, 58, 91, 66, 66, 62, 19, 62, 2, 58, 47, 66, 66, 62, 236, 20, 0, 0, 38, 66, 0, 3, 32, 66, 66, 0, 41, 62, 1, 24, 42, 62, 62, 24, 32, 62, 62, 2, 19, 66, 66, 62, 41, 62, 2, 24, 42, 62, 62, 24, 32, 62, 62, 29, 19, 66, 66, 62, 120, 66, 4, 0, 1, 66, 255, 255, 83, 55, 66, 0, 119, 0, 4, 8, 2, 66, 0, 0, 136, 72, 118, 1, 84, 66, 0, 0, 2, 66, 0, 0, 138, 72, 118, 1, 83, 66, 1, 0, 2, 66, 0, 0, 139, 72, 118, 1, 83, 66, 2, 0, 1, 66, 0, 0, 83, 55, 66, 0, 119, 0, 248, 7, 1, 66, 0, 0, 84, 55, 66, 0, 1, 62, 26, 0, 134, 66, 0, 0, 28, 73, 1, 0, 62, 0, 0, 0, 78, 0, 55, 0, 41, 66, 0, 24, 42, 66, 66, 24, 121, 66, 4, 0, 19, 62, 0, 58, 135, 66, 43, 0, 62, 0, 0, 0, 2, 66, 0, 0, 201, 68, 118, 1, 1, 62, 44, 0, 83, 66, 62, 0, 2, 62, 0, 0, 204, 68, 118, 1, 81, 62, 62, 0, 41, 62, 62, 16, 2, 66, 0, 0, 208, 68, 118, 1, 81, 66, 66, 0, 20, 62, 62, 66, 0, 52, 62, 0, 2, 62, 0, 0, 216, 72, 118, 1, 82, 53, 62, 0, 16, 66, 52, 53, 1, 64, 0, 0, 125, 62, 66, 64, 53, 0, 0, 0, 4, 62, 52, 62, 77, 62, 62, 0, 62, 64, 0, 0, 129, 212, 158, 111, 92, 248, 21, 64, 65, 62, 62, 64, 75, 53, 62, 0, 29, 52, 53, 100, 2, 62, 0, 0, 208, 68, 118, 1, 27, 64, 52, 100, 4, 64, 53, 64, 83, 62, 64, 0, 2, 64, 0, 0, 209, 68, 118, 1, 31, 62, 52, 60, 83, 64, 62, 0, 2, 62, 0, 0, 204, 68, 118, 1, 1, 64, 112, 23, 7, 64, 53, 64, 31, 64, 64, 60, 83, 62, 64, 0, 2, 64, 0, 0, 205, 68, 118, 1, 2, 62, 0, 0, 64, 126, 5, 0, 7, 62, 53, 62, 31, 62, 62, 24, 83, 64, 62, 0, 135, 62, 12, 0, 119, 0, 183, 7, 1, 64, 14, 0, 1, 66, 2, 0, 135, 62, 3, 0, 21, 64, 66, 0, 2, 66, 0, 0, 90, 219, 3, 0, 135, 62, 33, 0, 21, 66, 0, 0, 1, 62, 23, 0, 2, 66, 0, 0, 205, 68, 118, 1, 79, 66, 66, 0, 15, 62, 62, 66, 1, 66, 59, 0, 2, 64, 0, 0, 204, 68, 118, 1, 79, 64, 64, 0, 15, 66, 66, 64, 20, 62, 62, 66, 1, 66, 59, 0, 2, 64, 0, 0, 209, 68, 118, 1, 79, 64, 64, 0, 15, 66, 66, 64, 20, 62, 62, 66, 1, 66, 99, 0, 2, 64, 0, 0, 208, 68, 118, 1, 79, 64, 64, 0, 15, 66, 66, 64, 20, 62, 62, 66, 121, 62, 4, 0, 1, 62, 255, 255, 83, 55, 62, 0, 119, 0, 148, 7, 2, 62, 0, 0, 208, 68, 118, 1, 80, 62, 62, 0, 2, 66, 0, 0, 204, 68, 118, 1, 80, 66, 66, 0, 20, 62, 62, 66, 41, 62, 62, 16, 42, 62, 62, 16, 120, 62, 12, 0, 1, 62, 108, 4, 135, 53, 44, 0, 62, 0, 0, 0, 2, 62, 0, 0, 216, 72, 118, 1, 85, 62, 53, 0, 2, 66, 0, 0, 124, 219, 3, 0, 135, 62, 45, 0, 66, 40, 0, 0, 119, 0, 5, 0, 2, 62, 0, 0, 216, 72, 118, 1, 1, 66, 0, 0, 85, 62, 66, 0, 1, 66, 0, 0, 83, 55, 66, 0, 119, 0, 120, 7, 2, 66, 0, 0, 159, 72, 118, 1, 78, 62, 55, 0, 32, 62, 62, 1, 38, 62, 62, 1, 83, 66, 62, 0, 119, 0, 113, 7, 2, 66, 0, 0, 136, 72, 118, 1, 135, 62, 46, 0, 66, 0, 0, 0, 43, 62, 62, 16, 0, 53, 62, 0, 2, 62, 0, 0, 136, 69, 118, 1, 84, 62, 53, 0, 2, 62, 0, 0, 152, 69, 118, 1, 41, 66, 53, 4, 85, 62, 66, 0, 2, 62, 0, 0, 136, 72, 118, 1, 135, 66, 46, 0, 62, 0, 0, 0, 2, 62, 0, 0, 255, 255, 0, 0, 19, 66, 66, 62, 0, 53, 66, 0, 2, 66, 0, 0, 212, 68, 118, 1, 84, 66, 53, 0, 119, 0, 88, 7, 78, 66, 55, 0, 1, 62, 0, 0, 1, 64, 2, 0, 138, 66, 62, 64, 184, 23, 0, 0, 196, 23, 0, 0, 119, 0, 7, 0, 1, 0, 255, 255, 1, 49, 106, 0, 119, 0, 4, 0, 1, 0, 16, 0, 1, 49, 106, 0, 119, 0, 1, 0, 32, 66, 49, 106, 121, 66, 4, 0, 2, 66, 0, 0, 213, 68, 118, 1, 83, 66, 0, 0, 2, 66, 0, 0, 140, 72, 118, 1, 78, 66, 66, 0, 83, 55, 66, 0, 2, 66, 0, 0, 201, 68, 118, 1, 2, 62, 0, 0, 141, 72, 118, 1, 78, 62, 62, 0, 83, 66, 62, 0, 2, 62, 0, 0, 212, 68, 118, 1, 1, 66, 0, 0, 83, 62, 66, 0, 2, 66, 0, 0, 204, 68, 118, 1, 1, 62, 0, 0, 84, 66, 62, 0, 119, 0, 51, 7, 2, 64, 0, 0, 136, 72, 118, 1, 135, 66, 0, 0, 64, 0, 0, 0, 2, 64, 0, 0, 208, 68, 118, 1, 135, 62, 47, 0, 66, 64, 0, 0, 2, 62, 0, 0, 136, 72, 118, 1, 135, 53, 0, 0, 62, 0, 0, 0, 1, 64, 1, 0, 78, 66, 55, 0, 135, 62, 6, 0, 53, 64, 66, 0, 119, 0, 34, 7, 119, 0, 192, 253, 78, 62, 55, 0, 1, 64, 0, 0, 1, 66, 7, 0, 138, 62, 64, 66, 216, 24, 0, 0, 244, 24, 0, 0, 24, 25, 0, 0, 84, 25, 0, 0, 128, 25, 0, 0, 132, 25, 0, 0, 152, 25, 0, 0, 1, 66, 14, 0, 1, 67, 2, 0, 135, 64, 3, 0, 23, 66, 67, 0, 2, 67, 0, 0, 216, 219, 3, 0, 79, 66, 55, 0, 76, 66, 66, 0, 135, 64, 21, 0, 23, 67, 66, 0, 1, 64, 255, 255, 83, 55, 64, 0, 119, 0, 9, 7, 2, 64, 0, 0, 208, 68, 118, 1, 2, 66, 0, 0, 160, 72, 118, 1, 78, 66, 66, 0, 83, 64, 66, 0, 119, 0, 2, 7, 2, 66, 0, 0, 160, 72, 118, 1, 2, 64, 0, 0, 208, 68, 118, 1, 78, 64, 64, 0, 33, 64, 64, 0, 38, 64, 64, 1, 83, 66, 64, 0, 119, 0, 249, 6, 2, 64, 0, 0, 160, 72, 118, 1, 78, 53, 64, 0, 2, 64, 0, 0, 160, 72, 118, 1, 2, 66, 0, 0, 208, 68, 118, 1, 78, 66, 66, 0, 33, 66, 66, 0, 38, 66, 66, 1, 83, 64, 66, 0, 2, 66, 0, 0, 208, 68, 118, 1, 83, 66, 53, 0, 119, 0, 234, 6, 1, 64, 14, 0, 1, 67, 2, 0, 135, 66, 3, 0, 22, 64, 67, 0, 2, 67, 0, 0, 187, 219, 3, 0, 81, 64, 55, 0, 76, 64, 64, 0, 135, 66, 21, 0, 22, 67, 64, 0, 119, 0, 223, 6, 119, 0, 245, 255, 2, 66, 0, 0, 208, 68, 118, 1, 1, 64, 3, 0, 83, 66, 64, 0, 119, 0, 217, 6, 2, 64, 0, 0, 212, 68, 118, 1, 2, 66, 0, 0, 140, 72, 118, 1, 78, 66, 66, 0, 83, 64, 66, 0, 2, 66, 0, 0, 213, 68, 118, 1, 2, 64, 0, 0, 141, 72, 118, 1, 78, 64, 64, 0, 83, 66, 64, 0, 2, 64, 0, 0, 208, 68, 118, 1, 2, 66, 0, 0, 142, 72, 118, 1, 78, 66, 66, 0, 83, 64, 66, 0, 2, 66, 0, 0, 209, 68, 118, 1, 1, 64, 16, 0, 83, 66, 64, 0, 119, 0, 194, 6, 2, 62, 0, 0, 136, 69, 118, 1, 1, 64, 178, 0, 84, 62, 64, 0, 2, 64, 0, 0, 152, 69, 118, 1, 1, 62, 32, 11, 85, 64, 62, 0, 2, 62, 0, 0, 212, 68, 118, 1, 1, 64, 1, 0, 84, 62, 64, 0, 119, 0, 181, 6, 79, 64, 55, 0, 41, 64, 64, 2, 135, 53, 5, 0, 64, 0, 0, 0, 2, 64, 0, 0, 212, 68, 118, 1, 84, 64, 53, 0, 79, 64, 55, 0, 41, 64, 64, 2, 39, 64, 64, 2, 135, 53, 5, 0, 64, 0, 0, 0, 2, 64, 0, 0, 136, 69, 118, 1, 84, 64, 53, 0, 2, 64, 0, 0, 152, 69, 118, 1, 2, 62, 0, 0, 255, 255, 0, 0, 19, 62, 53, 62, 41, 62, 62, 4, 85, 64, 62, 0, 119, 0, 158, 6, 2, 64, 0, 0, 208, 68, 118, 1, 78, 64, 64, 0, 135, 62, 48, 0, 64, 53, 4, 52, 50, 0, 0, 0, 121, 62, 16, 0, 79, 62, 4, 0, 84, 55, 62, 0, 2, 62, 0, 0, 212, 68, 118, 1, 80, 64, 50, 0, 84, 62, 64, 0, 2, 64, 0, 0, 204, 68, 118, 1, 80, 62, 53, 0, 84, 64, 62, 0, 2, 62, 0, 0, 208, 68, 118, 1, 80, 64, 52, 0, 84, 62, 64, 0, 119, 0, 136, 6, 2, 64, 0, 0, 208, 68, 118, 1, 78, 64, 64, 0, 120, 64, 2, 0, 135, 64, 30, 0, 1, 64, 255, 255, 84, 55, 64, 0, 119, 0, 128, 6, 78, 64, 55, 0, 1, 62, 0, 0, 1, 66, 4, 0, 138, 64, 62, 66, 32, 27, 0, 0, 60, 27, 0, 0, 72, 27, 0, 0, 100, 27, 0, 0, 119, 0, 21, 0, 1, 62, 0, 0, 83, 55, 62, 0, 2, 62, 0, 0, 208, 68, 118, 1, 1, 66, 47, 0, 83, 62, 66, 0, 119, 0, 14, 0, 1, 66, 0, 0, 83, 55, 66, 0, 119, 0, 11, 0, 1, 66, 0, 0, 83, 55, 66, 0, 2, 66, 0, 0, 208, 68, 118, 1, 1, 62, 47, 0, 83, 66, 62, 0, 119, 0, 4, 0, 1, 62, 0, 0, 83, 55, 62, 0, 119, 0, 1, 0, 1, 62, 21, 0, 1, 66, 2, 0, 135, 64, 3, 0, 24, 62, 66, 0, 2, 66, 0, 0, 236, 219, 3, 0, 135, 64, 33, 0, 24, 66, 0, 0, 119, 0, 90, 6, 78, 64, 55, 0, 120, 64, 24, 0, 2, 66, 0, 0, 164, 69, 118, 1, 82, 66, 66, 0, 2, 62, 0, 0, 208, 68, 118, 1, 81, 62, 62, 0, 3, 66, 66, 62, 2, 62, 0, 0, 192, 72, 118, 1, 82, 62, 62, 0, 1, 67, 24, 0, 135, 64, 49, 0, 66, 62, 67, 0, 2, 64, 0, 0, 212, 68, 118, 1, 1, 67, 1, 0, 84, 64, 67, 0, 1, 67, 1, 0, 84, 55, 67, 0, 1, 64, 0, 0, 135, 67, 50, 0, 64, 0, 0, 0, 119, 0, 65, 6, 1, 64, 21, 0, 1, 62, 2, 0, 135, 67, 3, 0, 25, 64, 62, 0, 2, 62, 0, 0, 23, 220, 3, 0, 135, 67, 33, 0, 25, 62, 0, 0, 1, 62, 1, 0, 135, 67, 50, 0, 62, 0, 0, 0, 119, 0, 53, 6, 2, 62, 0, 0, 164, 69, 118, 1, 82, 62, 62, 0, 2, 64, 0, 0, 208, 68, 118, 1, 81, 64, 64, 0, 3, 62, 62, 64, 1, 64, 0, 1, 135, 67, 41, 0, 62, 2, 64, 0, 135, 67, 51, 0, 2, 0, 0, 0, 121, 67, 7, 0, 1, 67, 5, 0, 84, 55, 67, 0, 1, 64, 0, 0, 135, 67, 50, 0, 64, 0, 0, 0, 119, 0, 34, 6, 2, 67, 0, 0, 146, 72, 118, 1, 80, 67, 67, 0, 84, 55, 67, 0, 1, 64, 1, 0, 135, 67, 50, 0, 64, 0, 0, 0, 119, 0, 26, 6, 2, 64, 0, 0, 164, 69, 118, 1, 82, 64, 64, 0, 2, 62, 0, 0, 208, 68, 118, 1, 81, 62, 62, 0, 3, 64, 64, 62, 1, 62, 0, 1, 135, 67, 41, 0, 64, 2, 62, 0, 135, 67, 52, 0, 2, 0, 0, 0, 121, 67, 7, 0, 1, 67, 5, 0, 84, 55, 67, 0, 1, 62, 0, 0, 135, 67, 50, 0, 62, 0, 0, 0, 119, 0, 7, 6, 2, 67, 0, 0, 146, 72, 118, 1, 80, 67, 67, 0, 84, 55, 67, 0, 1, 62, 1, 0, 135, 67, 50, 0, 62, 0, 0, 0, 1, 62, 21, 0, 1, 64, 0, 0, 135, 67, 3, 0, 26, 62, 64, 0, 2, 64, 0, 0, 62, 220, 3, 0, 2, 62, 0, 0, 146, 72, 118, 1, 81, 62, 62, 0, 76, 62, 62, 0, 135, 67, 53, 0, 26, 64, 2, 62, 119, 0, 243, 5, 2, 62, 0, 0, 164, 69, 118, 1, 82, 62, 62, 0, 2, 64, 0, 0, 208, 68, 118, 1, 81, 64, 64, 0, 3, 62, 62, 64, 1, 64, 0, 1, 135, 67, 41, 0, 62, 2, 64, 0, 135, 67, 54, 0, 2, 0, 0, 0, 121, 67, 7, 0, 1, 67, 0, 0, 84, 55, 67, 0, 1, 64, 0, 0, 135, 67, 50, 0, 64, 0, 0, 0, 119, 0, 224, 5, 2, 67, 0, 0, 146, 72, 118, 1, 80, 67, 67, 0, 84, 55, 67, 0, 1, 64, 1, 0, 135, 67, 50, 0, 64, 0, 0, 0, 119, 0, 216, 5, 2, 64, 0, 0, 164, 69, 118, 1, 82, 64, 64, 0, 2, 62, 0, 0, 208, 68, 118, 1, 81, 62, 62, 0, 3, 64, 64, 62, 1, 62, 0, 1, 135, 67, 41, 0, 64, 2, 62, 0, 2, 62, 0, 0, 204, 68, 118, 1, 80, 62, 62, 0, 1, 64, 0, 0, 135, 67, 55, 0, 2, 62, 55, 64, 121, 67, 5, 0, 1, 64, 0, 0, 135, 67, 50, 0, 64, 0, 0, 0, 119, 0, 195, 5, 2, 67, 0, 0, 146, 72, 118, 1, 80, 67, 67, 0, 84, 55, 67, 0, 1, 64, 1, 0, 135, 67, 50, 0, 64, 0, 0, 0, 119, 0, 187, 5, 2, 64, 0, 0, 164, 69, 118, 1, 82, 64, 64, 0, 2, 62, 0, 0, 208, 68, 118, 1, 81, 62, 62, 0, 3, 64, 64, 62, 1, 62, 0, 1, 135, 67, 41, 0, 64, 2, 62, 0, 78, 62, 55, 0, 1, 64, 0, 0, 135, 67, 56, 0, 2, 62, 55, 64, 121, 67, 5, 0, 1, 64, 0, 0, 135, 67, 50, 0, 64, 0, 0, 0, 119, 0, 168, 5, 2, 67, 0, 0, 146, 72, 118, 1, 80, 67, 67, 0, 84, 55, 67, 0, 1, 64, 1, 0, 135, 67, 50, 0, 64, 0, 0, 0, 119, 0, 160, 5, 2, 64, 0, 0, 212, 68, 118, 1, 80, 64, 64, 0, 1, 62, 0, 0, 135, 67, 57, 0, 64, 62, 0, 0, 121, 67, 5, 0, 1, 62, 0, 0, 135, 67, 50, 0, 62, 0, 0, 0, 119, 0, 149, 5, 2, 67, 0, 0, 146, 72, 118, 1, 80, 67, 67, 0, 84, 55, 67, 0, 1, 62, 1, 0, 135, 67, 50, 0, 62, 0, 0, 0, 119, 0, 141, 5, 2, 67, 0, 0, 204, 68, 118, 1, 80, 67, 67, 0, 84, 53, 67, 0, 2, 67, 0, 0, 161, 72, 118, 1, 1, 62, 1, 0, 83, 67, 62, 0, 2, 67, 0, 0, 212, 68, 118, 1, 80, 67, 67, 0, 2, 64, 0, 0, 80, 211, 7, 0, 1, 66, 0, 0, 134, 62, 0, 0, 4, 58, 1, 0, 67, 64, 53, 66, 121, 62, 19, 0, 2, 66, 0, 0, 164, 69, 118, 1, 82, 66, 66, 0, 2, 64, 0, 0, 208, 68, 118, 1, 81, 64, 64, 0, 3, 66, 66, 64, 2, 64, 0, 0, 80, 211, 7, 0, 81, 67, 53, 0, 135, 62, 49, 0, 66, 64, 67, 0, 80, 62, 53, 0, 84, 55, 62, 0, 1, 67, 0, 0, 135, 62, 50, 0, 67, 0, 0, 0, 119, 0, 8, 0, 2, 62, 0, 0, 146, 72, 118, 1, 80, 62, 62, 0, 84, 55, 62, 0, 1, 67, 1, 0, 135, 62, 50, 0, 67, 0, 0, 0, 81, 67, 55, 0, 135, 62, 58, 0, 67, 0, 0, 0, 2, 62, 0, 0, 161, 72, 118, 1, 1, 67, 0, 0, 83, 62, 67, 0, 119, 0, 90, 5, 2, 67, 0, 0, 204, 68, 118, 1, 80, 52, 67, 0, 84, 53, 52, 0, 2, 62, 0, 0, 164, 69, 118, 1, 82, 62, 62, 0, 2, 64, 0, 0, 208, 68, 118, 1, 81, 64, 64, 0, 3, 62, 62, 64, 2, 64, 0, 0, 80, 211, 7, 0, 2, 66, 0, 0, 255, 255, 0, 0, 19, 66, 52, 66, 135, 67, 59, 0, 62, 64, 66, 0, 2, 66, 0, 0, 212, 68, 118, 1, 80, 66, 66, 0, 2, 64, 0, 0, 80, 211, 7, 0, 1, 62, 0, 0, 135, 67, 7, 0, 66, 64, 53, 62, 121, 67, 7, 0, 80, 67, 53, 0, 84, 55, 67, 0, 1, 62, 0, 0, 135, 67, 50, 0, 62, 0, 0, 0, 119, 0, 8, 0, 2, 67, 0, 0, 146, 72, 118, 1, 80, 67, 67, 0, 84, 55, 67, 0, 1, 62, 1, 0, 135, 67, 50, 0, 62, 0, 0, 0, 81, 62, 55, 0, 135, 67, 58, 0, 62, 0, 0, 0, 119, 0, 46, 5, 2, 62, 0, 0, 164, 69, 118, 1, 82, 62, 62, 0, 2, 64, 0, 0, 208, 68, 118, 1, 81, 64, 64, 0, 3, 62, 62, 64, 1, 64, 0, 1, 135, 67, 41, 0, 62, 2, 64, 0, 135, 67, 60, 0, 2, 0, 0, 0, 121, 67, 5, 0, 1, 64, 0, 0, 135, 67, 50, 0, 64, 0, 0, 0, 119, 0, 29, 5, 2, 67, 0, 0, 146, 72, 118, 1, 80, 67, 67, 0, 84, 55, 67, 0, 1, 64, 1, 0, 135, 67, 50, 0, 64, 0, 0, 0, 119, 0, 21, 5, 2, 67, 0, 0, 204, 68, 118, 1, 81, 67, 67, 0, 41, 67, 67, 16, 2, 64, 0, 0, 208, 68, 118, 1, 81, 64, 64, 0, 20, 67, 67, 64, 85, 53, 67, 0, 2, 64, 0, 0, 212, 68, 118, 1, 80, 64, 64, 0, 79, 62, 55, 0, 1, 66, 0, 0, 135, 67, 61, 0, 64, 53, 62, 66, 121, 67, 11, 0, 82, 53, 53, 0, 2, 67, 0, 0, 208, 68, 118, 1, 43, 66, 53, 16, 84, 67, 66, 0, 84, 55, 53, 0, 1, 67, 0, 0, 135, 66, 50, 0, 67, 0, 0, 0, 119, 0, 250, 4, 2, 66, 0, 0, 146, 72, 118, 1, 80, 66, 66, 0, 84, 55, 66, 0, 1, 67, 1, 0, 135, 66, 50, 0, 67, 0, 0, 0, 119, 0, 242, 4, 2, 67, 0, 0, 164, 69, 118, 1, 82, 67, 67, 0, 2, 62, 0, 0, 208, 68, 118, 1, 81, 62, 62, 0, 3, 67, 67, 62, 1, 62, 0, 1, 135, 66, 41, 0, 67, 2, 62, 0, 78, 66, 55, 0, 1, 62, 0, 0, 1, 64, 2, 0, 138, 66, 62, 64, 180, 33, 0, 0, 20, 34, 0, 0, 1, 64, 21, 0, 1, 67, 2, 0, 135, 62, 3, 0, 28, 64, 67, 0, 2, 67, 0, 0, 145, 220, 3, 0, 79, 64, 55, 0, 76, 64, 64, 0, 135, 62, 21, 0, 28, 67, 64, 0, 1, 62, 1, 0, 84, 55, 62, 0, 1, 64, 1, 0, 135, 62, 50, 0, 64, 0, 0, 0, 119, 0, 210, 4, 2, 62, 0, 0, 204, 68, 118, 1, 80, 62, 62, 0, 84, 53, 62, 0, 135, 62, 62, 0, 2, 53, 0, 0, 121, 62, 10, 0, 80, 53, 53, 0, 2, 62, 0, 0, 204, 68, 118, 1, 84, 62, 53, 0, 84, 55, 53, 0, 1, 67, 0, 0, 135, 62, 50, 0, 67, 0, 0, 0, 119, 0, 194, 4, 1, 67, 1, 0, 135, 62, 50, 0, 67, 0, 0, 0, 2, 62, 0, 0, 146, 72, 118, 1, 80, 62, 62, 0, 84, 55, 62, 0, 119, 0, 186, 4, 1, 67, 21, 0, 1, 64, 2, 0, 135, 62, 3, 0, 27, 67, 64, 0, 2, 64, 0, 0, 100, 220, 3, 0, 135, 62, 63, 0, 27, 64, 2, 0, 2, 64, 0, 0, 204, 68, 118, 1, 80, 64, 64, 0, 135, 62, 64, 0, 2, 64, 0, 0, 121, 62, 7, 0, 1, 62, 2, 2, 84, 55, 62, 0, 1, 64, 0, 0, 135, 62, 50, 0, 64, 0, 0, 0, 119, 0, 166, 4, 1, 64, 1, 0, 135, 62, 50, 0, 64, 0, 0, 0, 2, 62, 0, 0, 146, 72, 118, 1, 80, 62, 62, 0, 84, 55, 62, 0, 119, 0, 158, 4, 135, 66, 65, 0, 121, 66, 5, 0, 1, 62, 0, 0, 135, 66, 50, 0, 62, 0, 0, 0, 119, 0, 152, 4, 2, 66, 0, 0, 146, 72, 118, 1, 80, 66, 66, 0, 84, 55, 66, 0, 1, 62, 1, 0, 135, 66, 50, 0, 62, 0, 0, 0, 119, 0, 144, 4, 2, 62, 0, 0, 212, 68, 118, 1, 80, 62, 62, 0, 135, 66, 66, 0, 62, 55, 0, 0, 121, 66, 5, 0, 1, 62, 0, 0, 135, 66, 50, 0, 62, 0, 0, 0, 119, 0, 134, 4, 2, 66, 0, 0, 146, 72, 118, 1, 80, 66, 66, 0, 84, 55, 66, 0, 1, 62, 1, 0, 135, 66, 50, 0, 62, 0, 0, 0, 119, 0, 126, 4, 2, 62, 0, 0, 212, 68, 118, 1, 80, 62, 62, 0, 2, 64, 0, 0, 204, 68, 118, 1, 80, 64, 64, 0, 135, 66, 67, 0, 62, 64, 0, 0, 121, 66, 9, 0, 2, 66, 0, 0, 204, 68, 118, 1, 80, 66, 66, 0, 84, 55, 66, 0, 1, 64, 0, 0, 135, 66, 50, 0, 64, 0, 0, 0, 119, 0, 109, 4, 2, 66, 0, 0, 146, 72, 118, 1, 80, 66, 66, 0, 84, 55, 66, 0, 1, 64, 1, 0, 135, 66, 50, 0, 64, 0, 0, 0, 119, 0, 101, 4, 2, 64, 0, 0, 208, 68, 118, 1, 78, 64, 64, 0, 135, 66, 68, 0, 64, 2, 0, 0, 121, 66, 19, 0, 2, 66, 0, 0, 164, 69, 118, 1, 82, 66, 66, 0, 2, 64, 0, 0, 224, 68, 118, 1, 81, 64, 64, 0, 3, 53, 66, 64, 135, 66, 69, 0, 2, 0, 0, 0, 25, 66, 66, 1, 135, 64, 49, 0, 53, 2, 66, 0, 1, 64, 0, 1, 84, 55, 64, 0, 1, 66, 0, 0, 135, 64, 50, 0, 66, 0, 0, 0, 119, 0, 77, 4, 2, 64, 0, 0, 146, 72, 118, 1, 80, 64, 64, 0, 84, 55, 64, 0, 1, 66, 1, 0, 135, 64, 50, 0, 66, 0, 0, 0, 119, 0, 69, 4, 2, 64, 0, 0, 212, 68, 118, 1, 80, 64, 64, 0, 84, 53, 64, 0, 135, 64, 70, 0, 52, 53, 0, 0, 121, 64, 7, 0, 80, 64, 52, 0, 84, 55, 64, 0, 1, 66, 0, 0, 135, 64, 50, 0, 66, 0, 0, 0, 119, 0, 56, 4, 2, 64, 0, 0, 146, 72, 118, 1, 80, 64, 64, 0, 84, 55, 64, 0, 2, 64, 0, 0, 212, 68, 118, 1, 80, 66, 53, 0, 84, 64, 66, 0, 1, 64, 1, 0, 135, 66, 50, 0, 64, 0, 0, 0, 119, 0, 44, 4, 2, 64, 0, 0, 136, 69, 118, 1, 80, 64, 64, 0, 135, 66, 71, 0, 64, 0, 0, 0, 121, 66, 5, 0, 1, 64, 0, 0, 135, 66, 50, 0, 64, 0, 0, 0, 119, 0, 34, 4, 2, 66, 0, 0, 146, 72, 118, 1, 80, 66, 66, 0, 84, 55, 66, 0, 1, 64, 1, 0, 135, 66, 50, 0, 64, 0, 0, 0, 119, 0, 26, 4, 2, 66, 0, 0, 212, 68, 118, 1, 80, 66, 66, 0, 84, 53, 66, 0, 2, 64, 0, 0, 136, 69, 118, 1, 80, 64, 64, 0, 135, 66, 47, 0, 64, 53, 0, 0, 121, 66, 9, 0, 2, 66, 0, 0, 136, 69, 118, 1, 80, 66, 66, 0, 84, 55, 66, 0, 1, 64, 0, 0, 135, 66, 50, 0, 64, 0, 0, 0, 119, 0, 8, 4, 2, 66, 0, 0, 146, 72, 118, 1, 80, 66, 66, 0, 84, 55, 66, 0, 2, 66, 0, 0, 212, 68, 118, 1, 80, 64, 53, 0, 84, 66, 64, 0, 1, 66, 1, 0, 135, 64, 50, 0, 66, 0, 0, 0, 119, 0, 252, 3, 2, 66, 0, 0, 164, 69, 118, 1, 82, 66, 66, 0, 2, 62, 0, 0, 208, 68, 118, 1, 81, 62, 62, 0, 3, 66, 66, 62, 1, 62, 0, 1, 135, 64, 41, 0, 66, 2, 62, 0, 1, 62, 13, 0, 1, 66, 2, 0, 135, 64, 3, 0, 29, 62, 66, 0, 2, 66, 0, 0, 178, 220, 3, 0, 79, 62, 55, 0, 76, 62, 62, 0, 135, 64, 53, 0, 29, 66, 2, 62, 2, 62, 0, 0, 152, 69, 118, 1, 82, 62, 62, 0, 2, 66, 0, 0, 212, 68, 118, 1, 81, 66, 66, 0, 3, 62, 62, 66, 78, 66, 55, 0, 135, 64, 72, 0, 2, 62, 66, 0, 120, 64, 221, 3, 2, 64, 0, 0, 146, 72, 118, 1, 80, 64, 64, 0, 84, 55, 64, 0, 1, 66, 1, 0, 135, 64, 50, 0, 66, 0, 0, 0, 119, 0, 213, 3, 2, 64, 0, 0, 136, 72, 118, 1, 135, 53, 0, 0, 64, 0, 0, 0, 1, 66, 0, 0, 78, 62, 55, 0, 135, 64, 6, 0, 53, 66, 62, 0, 119, 0, 204, 3, 2, 64, 0, 0, 156, 72, 118, 1, 78, 64, 64, 0, 83, 55, 64, 0, 2, 64, 0, 0, 201, 68, 118, 1, 2, 62, 0, 0, 157, 72, 118, 1, 78, 62, 62, 0, 83, 64, 62, 0, 119, 0, 193, 3, 2, 64, 0, 0, 164, 69, 118, 1, 82, 64, 64, 0, 2, 66, 0, 0, 208, 68, 118, 1, 81, 66, 66, 0, 3, 64, 64, 66, 1, 66, 0, 1, 135, 62, 41, 0, 64, 2, 66, 0, 2, 66, 0, 0, 204, 68, 118, 1, 80, 66, 66, 0, 1, 64, 0, 0, 135, 62, 73, 0, 2, 66, 64, 0, 121, 62, 7, 0, 1, 64, 0, 0, 135, 62, 50, 0, 64, 0, 0, 0, 1, 62, 0, 0, 84, 55, 62, 0, 119, 0, 170, 3, 2, 62, 0, 0, 146, 72, 118, 1, 80, 62, 62, 0, 84, 55, 62, 0, 1, 64, 1, 0, 135, 62, 50, 0, 64, 0, 0, 0, 119, 0, 162, 3, 135, 62, 74, 0, 121, 62, 7, 0, 1, 64, 0, 0, 135, 62, 50, 0, 64, 0, 0, 0, 1, 62, 0, 0, 84, 55, 62, 0, 119, 0, 154, 3, 2, 62, 0, 0, 146, 72, 118, 1, 80, 62, 62, 0, 84, 55, 62, 0, 1, 64, 1, 0, 135, 62, 50, 0, 64, 0, 0, 0, 119, 0, 146, 3, 2, 64, 0, 0, 136, 72, 118, 1, 2, 66, 0, 0, 212, 68, 118, 1, 80, 66, 66, 0, 135, 62, 75, 0, 64, 66, 0, 0, 119, 0, 138, 3, 2, 62, 0, 0, 136, 72, 118, 1, 135, 53, 0, 0, 62, 0, 0, 0, 2, 62, 0, 0, 212, 68, 118, 1, 84, 62, 53, 0, 119, 0, 130, 3, 2, 62, 0, 0, 204, 72, 118, 1, 135, 53, 76, 0, 62, 0, 0, 0, 43, 62, 53, 16, 0, 52, 62, 0, 2, 62, 0, 0, 136, 69, 118, 1, 84, 62, 52, 0, 2, 62, 0, 0, 152, 69, 118, 1, 41, 66, 52, 4, 85, 62, 66, 0, 2, 66, 0, 0, 212, 68, 118, 1, 84, 66, 53, 0, 1, 62, 14, 0, 1, 64, 0, 0, 135, 66, 3, 0, 30, 62, 64, 0, 2, 64, 0, 0, 192, 220, 3, 0, 135, 66, 33, 0, 30, 64, 0, 0, 119, 0, 105, 3, 85, 41, 0, 0, 2, 64, 0, 0, 249, 220, 3, 0, 135, 66, 11, 0, 64, 41, 0, 0, 119, 0, 99, 3, 2, 66, 0, 0, 159, 72, 118, 1, 78, 66, 66, 0, 83, 55, 66, 0, 119, 0, 94, 3, 2, 64, 0, 0, 208, 68, 118, 1, 80, 64, 64, 0, 2, 62, 0, 0, 224, 68, 118, 1, 80, 62, 62, 0, 135, 66, 77, 0, 64, 62, 0, 0, 2, 62, 0, 0, 136, 72, 118, 1, 2, 64, 0, 0, 208, 68, 118, 1, 80, 64, 64, 0, 135, 66, 75, 0, 62, 64, 0, 0, 1, 66, 240, 255, 83, 55, 66, 0, 119, 0, 76, 3, 2, 64, 0, 0, 164, 69, 118, 1, 82, 64, 64, 0, 2, 62, 0, 0, 208, 68, 118, 1, 81, 62, 62, 0, 3, 64, 64, 62, 1, 62, 0, 1, 135, 66, 41, 0, 64, 2, 62, 0, 2, 62, 0, 0, 152, 69, 118, 1, 82, 62, 62, 0], eb + 0);
  HEAPU8.set([2, 64, 0, 0, 228, 68, 118, 1, 81, 64, 64, 0, 3, 62, 62, 64, 1, 64, 0, 1, 135, 66, 41, 0, 62, 3, 64, 0, 135, 66, 78, 0, 2, 3, 0, 0, 121, 66, 5, 0, 1, 64, 0, 0, 135, 66, 50, 0, 64, 0, 0, 0, 119, 0, 49, 3, 2, 66, 0, 0, 146, 72, 118, 1, 80, 66, 66, 0, 84, 55, 66, 0, 1, 64, 1, 0, 135, 66, 50, 0, 64, 0, 0, 0, 119, 0, 41, 3, 78, 66, 55, 0, 1, 64, 0, 0, 1, 67, 2, 0, 138, 66, 64, 67, 156, 40, 0, 0, 228, 40, 0, 0, 1, 67, 14, 0, 1, 65, 2, 0, 135, 64, 3, 0, 32, 67, 65, 0, 2, 65, 0, 0, 52, 221, 3, 0, 79, 67, 55, 0, 76, 67, 67, 0, 135, 64, 21, 0, 32, 65, 67, 0, 119, 0, 24, 3, 2, 62, 0, 0, 212, 68, 118, 1, 80, 62, 62, 0, 2, 67, 0, 0, 204, 68, 118, 1, 2, 65, 0, 0, 208, 68, 118, 1, 135, 64, 79, 0, 62, 67, 65, 0, 121, 64, 5, 0, 1, 65, 0, 0, 135, 64, 50, 0, 65, 0, 0, 0, 119, 0, 10, 3, 1, 65, 1, 0, 135, 64, 50, 0, 65, 0, 0, 0, 119, 0, 6, 3, 1, 65, 14, 0, 1, 67, 2, 0, 135, 64, 3, 0, 31, 65, 67, 0, 2, 67, 0, 0, 20, 221, 3, 0, 135, 64, 33, 0, 31, 67, 0, 0, 1, 67, 0, 0, 135, 64, 50, 0, 67, 0, 0, 0, 119, 0, 250, 2, 78, 66, 55, 0, 1, 64, 0, 0, 1, 67, 4, 0, 138, 66, 64, 67, 116, 41, 0, 0, 128, 41, 0, 0, 192, 41, 0, 0, 236, 41, 0, 0, 1, 67, 14, 0, 1, 65, 2, 0, 135, 64, 3, 0, 33, 67, 65, 0, 2, 65, 0, 0, 82, 221, 3, 0, 79, 67, 55, 0, 76, 67, 67, 0, 135, 64, 21, 0, 33, 65, 67, 0, 1, 64, 1, 0, 84, 55, 64, 0, 1, 67, 1, 0, 135, 64, 50, 0, 67, 0, 0, 0, 119, 0, 226, 2, 135, 53, 80, 0, 84, 55, 53, 0, 119, 0, 223, 2, 2, 67, 0, 0, 212, 68, 118, 1, 80, 67, 67, 0, 135, 64, 81, 0, 67, 0, 0, 0, 121, 64, 5, 0, 1, 67, 0, 0, 135, 64, 50, 0, 67, 0, 0, 0, 119, 0, 213, 2, 1, 64, 1, 0, 84, 55, 64, 0, 1, 67, 1, 0, 135, 64, 50, 0, 67, 0, 0, 0, 119, 0, 207, 2, 2, 67, 0, 0, 204, 72, 118, 1, 135, 64, 82, 0, 67, 0, 0, 0, 38, 64, 64, 1, 0, 53, 64, 0, 83, 55, 53, 0, 1, 67, 0, 0, 135, 64, 50, 0, 67, 0, 0, 0, 119, 0, 196, 2, 2, 67, 0, 0, 212, 68, 118, 1, 80, 67, 67, 0, 135, 64, 83, 0, 67, 0, 0, 0, 121, 64, 5, 0, 1, 67, 0, 0, 135, 64, 50, 0, 67, 0, 0, 0, 119, 0, 186, 2, 1, 64, 1, 0, 84, 55, 64, 0, 1, 67, 1, 0, 135, 64, 50, 0, 67, 0, 0, 0, 119, 0, 180, 2, 2, 66, 0, 0, 146, 72, 118, 1, 80, 53, 66, 0, 84, 55, 53, 0, 2, 66, 0, 0, 213, 68, 118, 1, 38, 67, 53, 254, 41, 67, 67, 16, 42, 67, 67, 16, 32, 67, 67, 2, 1, 65, 8, 0, 1, 62, 0, 0, 125, 64, 67, 65, 62, 0, 0, 0, 83, 66, 64, 0, 2, 64, 0, 0, 212, 68, 118, 1, 1, 66, 1, 0, 83, 64, 66, 0, 2, 66, 0, 0, 205, 68, 118, 1, 1, 64, 0, 0, 83, 66, 64, 0, 119, 0, 156, 2, 2, 66, 0, 0, 164, 69, 118, 1, 82, 66, 66, 0, 2, 62, 0, 0, 208, 68, 118, 1, 81, 62, 62, 0, 3, 66, 66, 62, 1, 62, 0, 1, 135, 64, 41, 0, 66, 2, 62, 0, 135, 64, 84, 0, 2, 53, 0, 0, 121, 64, 19, 0, 80, 64, 53, 0, 84, 55, 64, 0, 2, 64, 0, 0, 164, 69, 118, 1, 82, 64, 64, 0, 2, 62, 0, 0, 208, 68, 118, 1, 81, 62, 62, 0, 3, 53, 64, 62, 135, 64, 69, 0, 2, 0, 0, 0, 25, 64, 64, 1, 135, 62, 49, 0, 53, 2, 64, 0, 1, 64, 0, 0, 135, 62, 50, 0, 64, 0, 0, 0, 119, 0, 125, 2, 2, 62, 0, 0, 146, 72, 118, 1, 80, 62, 62, 0, 84, 55, 62, 0, 1, 64, 1, 0, 135, 62, 50, 0, 64, 0, 0, 0, 119, 0, 117, 2, 2, 64, 0, 0, 164, 69, 118, 1, 82, 64, 64, 0, 2, 66, 0, 0, 208, 68, 118, 1, 81, 66, 66, 0, 3, 64, 64, 66, 1, 66, 0, 1, 135, 62, 41, 0, 64, 2, 66, 0, 1, 66, 0, 0, 1, 64, 0, 0, 135, 62, 56, 0, 2, 66, 53, 64, 121, 62, 16, 0, 80, 64, 53, 0, 1, 66, 0, 0, 135, 62, 57, 0, 64, 66, 0, 0, 1, 66, 80, 0, 135, 62, 85, 0, 66, 0, 0, 0, 2, 62, 0, 0, 146, 72, 118, 1, 80, 62, 62, 0, 84, 55, 62, 0, 1, 66, 1, 0, 135, 62, 50, 0, 66, 0, 0, 0, 119, 0, 87, 2, 2, 66, 0, 0, 204, 68, 118, 1, 80, 66, 66, 0, 1, 64, 0, 0, 135, 62, 55, 0, 2, 66, 53, 64, 121, 62, 7, 0, 80, 62, 53, 0, 84, 55, 62, 0, 1, 64, 0, 0, 135, 62, 50, 0, 64, 0, 0, 0, 119, 0, 74, 2, 2, 62, 0, 0, 146, 72, 118, 1, 80, 62, 62, 0, 84, 55, 62, 0, 1, 64, 1, 0, 135, 62, 50, 0, 64, 0, 0, 0, 119, 0, 66, 2, 1, 64, 1, 0, 135, 62, 85, 0, 64, 0, 0, 0, 2, 62, 0, 0, 146, 72, 118, 1, 80, 62, 62, 0, 84, 55, 62, 0, 1, 64, 1, 0, 135, 62, 50, 0, 64, 0, 0, 0, 119, 0, 55, 2, 78, 62, 55, 0, 32, 62, 62, 6, 121, 62, 52, 2, 2, 62, 0, 0, 142, 69, 118, 1, 1, 64, 178, 0, 84, 62, 64, 0, 2, 64, 0, 0, 164, 69, 118, 1, 1, 62, 32, 11, 85, 64, 62, 0, 2, 62, 0, 0, 224, 68, 118, 1, 1, 64, 0, 0, 84, 62, 64, 0, 2, 64, 0, 0, 204, 68, 118, 1, 1, 62, 128, 0, 84, 64, 62, 0, 2, 62, 0, 0, 208, 68, 118, 1, 1, 64, 26, 0, 84, 62, 64, 0, 1, 62, 14, 0, 1, 66, 2, 0, 135, 64, 3, 0, 34, 62, 66, 0, 2, 66, 0, 0, 138, 221, 3, 0, 135, 64, 33, 0, 34, 66, 0, 0, 119, 0, 23, 2, 1, 64, 1, 0, 84, 55, 64, 0, 1, 66, 1, 0, 135, 64, 50, 0, 66, 0, 0, 0, 119, 0, 17, 2, 2, 66, 0, 0, 164, 69, 118, 1, 82, 66, 66, 0, 2, 62, 0, 0, 224, 68, 118, 1, 81, 62, 62, 0, 3, 66, 66, 62, 1, 62, 0, 1, 135, 64, 41, 0, 66, 2, 62, 0, 135, 64, 86, 0, 2, 3, 0, 0, 121, 64, 17, 0, 2, 64, 0, 0, 152, 69, 118, 1, 82, 64, 64, 0, 2, 62, 0, 0, 228, 68, 118, 1, 81, 62, 62, 0, 3, 53, 64, 62, 135, 64, 69, 0, 3, 0, 0, 0, 25, 64, 64, 1, 135, 62, 49, 0, 53, 3, 64, 0, 1, 64, 0, 0, 135, 62, 50, 0, 64, 0, 0, 0, 119, 0, 244, 1, 2, 62, 0, 0, 146, 72, 118, 1, 80, 62, 62, 0, 84, 55, 62, 0, 1, 64, 1, 0, 135, 62, 50, 0, 64, 0, 0, 0, 119, 0, 236, 1, 2, 62, 0, 0, 136, 72, 118, 1, 135, 53, 0, 0, 62, 0, 0, 0, 2, 62, 0, 0, 212, 68, 118, 1, 84, 62, 53, 0, 119, 0, 228, 1, 78, 62, 55, 0, 120, 62, 22, 0, 2, 62, 0, 0, 176, 72, 118, 1, 82, 53, 62, 0, 43, 62, 53, 16, 0, 52, 62, 0, 2, 62, 0, 0, 142, 69, 118, 1, 84, 62, 52, 0, 2, 62, 0, 0, 164, 69, 118, 1, 41, 64, 52, 4, 85, 62, 64, 0, 2, 64, 0, 0, 224, 68, 118, 1, 84, 64, 53, 0, 1, 64, 0, 0, 83, 55, 64, 0, 1, 62, 0, 0, 135, 64, 50, 0, 62, 0, 0, 0, 119, 0, 205, 1, 1, 64, 255, 255, 83, 55, 64, 0, 119, 0, 202, 1, 1, 62, 14, 0, 1, 66, 0, 0, 135, 64, 3, 0, 35, 62, 66, 0, 2, 66, 0, 0, 172, 221, 3, 0, 135, 64, 33, 0, 35, 66, 0, 0, 119, 0, 193, 1, 1, 66, 14, 0, 1, 62, 2, 0, 135, 64, 3, 0, 36, 66, 62, 0, 2, 62, 0, 0, 199, 221, 3, 0, 81, 66, 55, 0, 76, 66, 66, 0, 135, 64, 21, 0, 36, 62, 66, 0, 78, 0, 55, 0, 2, 64, 0, 0, 204, 68, 118, 1, 80, 1, 64, 0, 19, 64, 0, 58, 34, 64, 64, 8, 2, 66, 0, 0, 255, 255, 0, 0, 19, 66, 1, 66, 34, 66, 66, 5, 19, 64, 64, 66, 121, 64, 8, 0, 1, 66, 1, 0, 135, 64, 85, 0, 66, 0, 0, 0, 1, 66, 1, 0, 135, 64, 50, 0, 66, 0, 0, 0, 119, 0, 164, 1, 2, 64, 0, 0, 152, 69, 118, 1, 82, 64, 64, 0, 2, 66, 0, 0, 228, 68, 118, 1, 81, 66, 66, 0, 3, 2, 64, 66, 41, 66, 0, 24, 42, 66, 66, 24, 1, 65, 1, 0, 1, 67, 34, 0, 138, 66, 65, 67, 64, 47, 0, 0, 72, 48, 0, 0, 140, 48, 0, 0, 204, 48, 0, 0, 208, 48, 0, 0, 20, 49, 0, 0, 88, 49, 0, 0, 36, 47, 0, 0, 36, 47, 0, 0, 36, 47, 0, 0, 36, 47, 0, 0, 36, 47, 0, 0, 36, 47, 0, 0, 36, 47, 0, 0, 36, 47, 0, 0, 36, 47, 0, 0, 36, 47, 0, 0, 36, 47, 0, 0, 36, 47, 0, 0, 36, 47, 0, 0, 36, 47, 0, 0, 36, 47, 0, 0, 36, 47, 0, 0, 36, 47, 0, 0, 36, 47, 0, 0, 36, 47, 0, 0, 36, 47, 0, 0, 36, 47, 0, 0, 36, 47, 0, 0, 36, 47, 0, 0, 36, 47, 0, 0, 92, 49, 0, 0, 148, 49, 0, 0, 128, 50, 0, 0, 19, 65, 0, 58, 85, 46, 65, 0, 2, 67, 0, 0, 12, 222, 3, 0, 135, 65, 11, 0, 67, 46, 0, 0, 119, 0, 111, 1, 1, 62, 1, 0, 135, 64, 16, 0, 2, 62, 0, 0, 25, 62, 2, 1, 1, 65, 38, 0, 135, 64, 87, 0, 62, 65, 0, 0, 25, 65, 2, 3, 1, 62, 1, 0, 135, 64, 87, 0, 65, 62, 0, 0, 1, 64, 6, 0, 2, 62, 0, 0, 204, 68, 118, 1, 81, 62, 62, 0, 47, 64, 64, 62, 56, 48, 0, 0, 25, 62, 2, 5, 2, 65, 0, 0, 200, 72, 118, 1, 80, 65, 65, 0, 135, 64, 87, 0, 62, 65, 0, 0, 2, 64, 0, 0, 204, 68, 118, 1, 80, 0, 64, 0, 1, 64, 8, 0, 2, 65, 0, 0, 255, 255, 0, 0, 19, 65, 0, 65, 47, 64, 64, 65, 56, 48, 0, 0, 25, 65, 2, 7, 2, 62, 0, 0, 192, 72, 118, 1, 82, 62, 62, 0, 1, 63, 40, 0, 2, 68, 0, 0, 255, 255, 0, 0, 19, 68, 0, 68, 47, 63, 63, 68, 244, 47, 0, 0, 1, 63, 34, 0, 0, 67, 63, 0, 119, 0, 6, 0, 2, 63, 0, 0, 255, 255, 0, 0, 19, 63, 0, 63, 26, 63, 63, 7, 0, 67, 63, 0, 135, 64, 49, 0, 65, 62, 67, 0, 2, 64, 0, 0, 204, 68, 118, 1, 81, 53, 64, 0, 2, 64, 0, 0, 204, 68, 118, 1, 35, 62, 53, 41, 1, 65, 41, 0, 125, 67, 62, 53, 65, 0, 0, 0, 84, 64, 67, 0, 1, 64, 0, 0, 135, 67, 50, 0, 64, 0, 0, 0, 119, 0, 45, 1, 1, 67, 2, 0, 135, 65, 16, 0, 2, 67, 0, 0, 25, 67, 2, 1, 2, 64, 0, 0, 188, 72, 118, 1, 82, 64, 64, 0, 135, 65, 38, 0, 67, 64, 0, 0, 2, 65, 0, 0, 204, 68, 118, 1, 1, 64, 5, 0, 84, 65, 64, 0, 1, 65, 0, 0, 135, 64, 50, 0, 65, 0, 0, 0, 119, 0, 28, 1, 135, 67, 16, 0, 2, 0, 0, 0, 25, 64, 2, 1, 2, 65, 0, 0, 176, 72, 118, 1, 82, 65, 65, 0, 135, 67, 38, 0, 64, 65, 0, 0, 2, 67, 0, 0, 204, 68, 118, 1, 1, 65, 5, 0, 84, 67, 65, 0, 1, 67, 0, 0, 135, 65, 50, 0, 67, 0, 0, 0, 119, 0, 12, 1, 119, 0, 240, 255, 1, 64, 5, 0, 135, 67, 16, 0, 2, 64, 0, 0, 25, 64, 2, 1, 2, 65, 0, 0, 180, 72, 118, 1, 82, 65, 65, 0, 135, 67, 38, 0, 64, 65, 0, 0, 2, 67, 0, 0, 204, 68, 118, 1, 1, 65, 5, 0, 84, 67, 65, 0, 1, 67, 0, 0, 135, 65, 50, 0, 67, 0, 0, 0, 119, 0, 250, 0, 1, 65, 6, 0, 135, 64, 16, 0, 2, 65, 0, 0, 25, 65, 2, 1, 2, 67, 0, 0, 184, 72, 118, 1, 82, 67, 67, 0, 135, 64, 38, 0, 65, 67, 0, 0, 2, 64, 0, 0, 204, 68, 118, 1, 1, 67, 5, 0, 84, 64, 67, 0, 1, 64, 0, 0, 135, 67, 50, 0, 64, 0, 0, 0, 119, 0, 233, 0, 119, 0, 205, 255, 2, 67, 0, 0, 208, 68, 118, 1, 79, 67, 67, 0, 135, 65, 88, 0, 67, 0, 0, 0, 19, 65, 65, 58, 0, 53, 65, 0, 2, 65, 0, 0, 208, 68, 118, 1, 83, 65, 53, 0, 1, 67, 0, 0, 135, 65, 50, 0, 67, 0, 0, 0, 119, 0, 218, 0, 2, 65, 0, 0, 164, 69, 118, 1, 82, 65, 65, 0, 2, 67, 0, 0, 208, 68, 118, 1, 81, 67, 67, 0, 3, 2, 65, 67, 41, 67, 0, 24, 42, 67, 67, 24, 32, 67, 67, 33, 121, 67, 6, 0, 2, 67, 0, 0, 255, 255, 0, 0, 19, 67, 1, 67, 0, 48, 67, 0, 119, 0, 13, 0, 135, 0, 89, 0, 2, 0, 0, 0, 2, 67, 0, 0, 255, 255, 0, 0, 48, 67, 67, 0, 0, 50, 0, 0, 2, 65, 0, 0, 243, 221, 3, 0, 135, 67, 11, 0, 65, 47, 0, 0, 119, 0, 2, 0, 0, 48, 0, 0, 121, 48, 27, 0, 2, 65, 0, 0, 80, 211, 7, 0, 135, 67, 59, 0, 2, 65, 48, 0, 2, 67, 0, 0, 80, 211, 7, 0, 1, 65, 0, 0, 95, 67, 48, 65, 1, 0, 0, 0, 52, 65, 0, 48, 96, 50, 0, 0, 2, 65, 0, 0, 80, 211, 7, 0, 3, 53, 65, 0, 79, 67, 53, 0, 135, 65, 88, 0, 67, 0, 0, 0, 19, 65, 65, 58, 0, 52, 65, 0, 83, 53, 52, 0, 25, 0, 0, 1, 119, 0, 244, 255, 2, 67, 0, 0, 80, 211, 7, 0, 135, 65, 49, 0, 2, 67, 48, 0, 1, 67, 0, 0, 135, 65, 50, 0, 67, 0, 0, 0, 119, 0, 159, 0, 119, 0, 197, 255, 78, 66, 55, 0, 32, 66, 66, 1, 121, 66, 22, 0, 1, 65, 14, 0, 1, 67, 2, 0, 135, 66, 3, 0, 37, 65, 67, 0, 2, 67, 0, 0, 60, 222, 3, 0, 135, 66, 33, 0, 37, 67, 0, 0, 2, 66, 0, 0, 200, 72, 118, 1, 80, 53, 66, 0, 2, 66, 0, 0, 208, 68, 118, 1, 84, 66, 53, 0, 2, 66, 0, 0, 212, 68, 118, 1, 84, 66, 53, 0, 1, 67, 0, 0, 135, 66, 50, 0, 67, 0, 0, 0, 119, 0, 134, 0, 1, 67, 14, 0, 1, 65, 0, 0, 135, 66, 3, 0, 38, 67, 65, 0, 2, 65, 0, 0, 91, 222, 3, 0, 135, 66, 33, 0, 38, 65, 0, 0, 119, 0, 125, 0, 2, 67, 0, 0, 136, 72, 118, 1, 135, 65, 0, 0, 67, 0, 0, 0, 135, 66, 1, 0, 53, 65, 0, 0, 2, 65, 0, 0, 212, 68, 118, 1, 80, 65, 65, 0, 135, 66, 90, 0, 53, 65, 0, 0, 1, 65, 0, 0, 135, 66, 50, 0, 65, 0, 0, 0, 119, 0, 110, 0, 2, 65, 0, 0, 212, 68, 118, 1, 79, 65, 65, 0, 135, 66, 91, 0, 65, 0, 0, 0, 121, 66, 5, 0, 1, 65, 0, 0, 135, 66, 50, 0, 65, 0, 0, 0, 119, 0, 100, 0, 2, 66, 0, 0, 146, 72, 118, 1, 80, 66, 66, 0, 84, 55, 66, 0, 1, 65, 1, 0, 135, 66, 50, 0, 65, 0, 0, 0, 119, 0, 92, 0, 78, 0, 55, 0, 41, 66, 0, 24, 42, 66, 66, 24, 1, 65, 0, 0, 1, 67, 2, 0, 138, 66, 65, 67, 176, 51, 0, 0, 224, 51, 0, 0, 119, 0, 23, 0, 1, 67, 14, 0, 1, 64, 2, 0, 135, 65, 3, 0, 43, 67, 64, 0, 2, 64, 0, 0, 136, 222, 3, 0, 135, 65, 33, 0, 43, 64, 0, 0, 1, 64, 1, 0, 135, 65, 50, 0, 64, 0, 0, 0, 119, 0, 71, 0, 1, 64, 14, 0, 1, 67, 2, 0, 135, 65, 3, 0, 42, 64, 67, 0, 2, 67, 0, 0, 163, 222, 3, 0, 135, 65, 33, 0, 42, 67, 0, 0, 78, 0, 55, 0, 119, 0, 1, 0, 19, 66, 0, 58, 85, 45, 66, 0, 2, 65, 0, 0, 190, 222, 3, 0, 135, 66, 11, 0, 65, 45, 0, 0, 119, 0, 54, 0, 2, 65, 0, 0, 164, 69, 118, 1, 82, 65, 65, 0, 2, 67, 0, 0, 224, 68, 118, 1, 81, 67, 67, 0, 3, 65, 65, 67, 1, 67, 0, 1, 135, 66, 41, 0, 65, 2, 67, 0, 2, 67, 0, 0, 212, 68, 118, 1, 80, 67, 67, 0, 2, 65, 0, 0, 204, 68, 118, 1, 80, 65, 65, 0, 2, 64, 0, 0, 208, 68, 118, 1, 80, 64, 64, 0, 2, 62, 0, 0, 204, 68, 118, 1, 135, 66, 92, 0, 2, 67, 65, 64, 55, 62, 0, 0, 121, 66, 5, 0, 1, 62, 0, 0, 135, 66, 50, 0, 62, 0, 0, 0, 119, 0, 25, 0, 2, 66, 0, 0, 146, 72, 118, 1, 80, 66, 66, 0, 84, 55, 66, 0, 1, 62, 1, 0, 135, 66, 50, 0, 62, 0, 0, 0, 119, 0, 17, 0, 1, 66, 0, 113, 84, 55, 66, 0, 1, 62, 1, 0, 135, 66, 50, 0, 62, 0, 0, 0, 1, 62, 14, 0, 1, 64, 0, 0, 135, 66, 3, 0, 6, 62, 64, 0, 2, 64, 0, 0, 229, 222, 3, 0, 79, 62, 55, 0, 76, 62, 62, 0, 135, 66, 21, 0, 6, 64, 62, 0, 119, 0, 1, 0, 137, 54, 0, 0, 1, 61, 0, 0, 139, 61, 0, 0, 140, 2, 49, 0, 0, 0, 0, 0, 2, 39, 0, 0, 255, 255, 0, 0, 2, 40, 0, 0, 146, 10, 4, 0, 2, 41, 0, 0, 151, 10, 4, 0, 2, 42, 0, 0, 156, 10, 4, 0, 136, 43, 0, 0, 0, 38, 43, 0, 136, 43, 0, 0, 1, 44, 144, 0, 3, 43, 43, 44, 137, 43, 0, 0, 1, 43, 135, 0, 3, 21, 38, 43, 25, 31, 38, 118, 25, 30, 38, 116, 0, 25, 38, 0, 1, 43, 134, 0, 3, 37, 38, 43, 25, 24, 38, 108, 25, 32, 38, 121, 25, 35, 38, 104, 25, 23, 38, 114, 25, 36, 38, 112, 25, 20, 38, 120, 25, 26, 38, 92, 25, 33, 38, 80, 1, 43, 1, 0, 84, 31, 43, 0, 1, 43, 0, 0, 84, 30, 43, 0, 1, 43, 0, 0, 83, 1, 43, 0, 25, 29, 0, 24, 25, 14, 0, 28, 25, 28, 0, 36, 25, 16, 0, 40, 25, 27, 0, 54, 25, 18, 0, 44, 25, 17, 0, 32, 0, 13, 28, 0, 25, 22, 0, 52, 1, 43, 1, 0, 4, 34, 43, 1, 25, 15, 26, 4, 25, 19, 26, 8, 1, 12, 0, 0, 82, 3, 16, 0, 82, 5, 14, 0, 1, 4, 254, 15, 1, 2, 0, 0, 1, 11, 0, 0, 0, 7, 4, 0, 120, 7, 2, 0, 119, 0, 212, 3, 2, 43, 0, 0, 161, 72, 118, 1, 1, 44, 0, 0, 83, 43, 44, 0, 80, 43, 27, 0, 1, 45, 0, 0, 134, 44, 0, 0, 4, 58, 1, 0, 43, 21, 31, 45, 120, 44, 20, 0, 80, 45, 27, 0, 1, 43, 0, 0, 135, 44, 57, 0, 45, 43, 0, 0, 2, 43, 0, 0, 95, 10, 4, 0, 1, 45, 2, 0, 1, 46, 0, 0, 135, 44, 56, 0, 43, 45, 25, 46, 1, 46, 21, 0, 1, 45, 2, 0, 135, 44, 3, 0, 37, 46, 45, 0, 2, 45, 0, 0, 99, 10, 4, 0, 135, 44, 33, 0, 37, 45, 0, 0, 119, 0, 232, 255, 80, 44, 31, 0, 120, 44, 3, 0, 1, 7, 0, 0, 119, 0, 222, 255, 78, 44, 21, 0, 1, 48, 0, 0, 1, 45, 28, 0, 138, 44, 48, 45, 204, 55, 0, 0, 244, 54, 0, 0, 244, 54, 0, 0, 244, 54, 0, 0, 244, 54, 0, 0, 244, 54, 0, 0, 244, 54, 0, 0, 244, 54, 0, 0, 28, 63, 0, 0, 12, 64, 0, 0, 184, 68, 0, 0, 244, 54, 0, 0, 244, 54, 0, 0, 200, 68, 0, 0, 244, 54, 0, 0, 244, 54, 0, 0, 244, 54, 0, 0, 244, 54, 0, 0, 244, 54, 0, 0, 244, 54, 0, 0, 244, 54, 0, 0, 244, 54, 0, 0, 244, 54, 0, 0, 244, 54, 0, 0, 244, 54, 0, 0, 244, 54, 0, 0, 244, 54, 0, 0, 228, 68, 0, 0, 82, 46, 18, 0, 121, 46, 3, 0, 135, 46, 93, 0, 28, 0, 0, 0, 48, 46, 2, 11, 128, 55, 0, 0, 1, 45, 32, 0, 135, 46, 94, 0, 45, 0, 0, 0, 4, 46, 11, 2, 84, 25, 46, 0, 3, 4, 1, 2, 1, 45, 1, 0, 1, 48, 0, 0, 135, 46, 7, 0, 45, 4, 25, 48, 1, 48, 8, 0, 135, 46, 94, 0, 48, 0, 0, 0, 0, 6, 11, 0, 57, 46, 6, 2, 108, 55, 0, 0, 26, 10, 6, 1, 90, 48, 1, 10, 95, 1, 6, 48, 1, 46, 8, 0, 135, 48, 94, 0, 46, 0, 0, 0, 0, 6, 10, 0, 119, 0, 247, 255, 25, 6, 11, 1, 1, 46, 0, 0, 95, 1, 6, 46, 26, 7, 7, 1, 119, 0, 3, 0, 3, 4, 1, 2, 0, 6, 11, 0, 78, 46, 21, 0, 83, 4, 46, 0, 25, 2, 2, 1, 48, 46, 6, 2, 176, 55, 0, 0, 1, 48, 0, 0, 95, 1, 2, 48, 26, 4, 7, 1, 25, 6, 6, 1, 119, 0, 2, 0, 0, 4, 7, 0, 1, 46, 1, 0, 1, 45, 0, 0, 135, 48, 7, 0, 46, 21, 31, 45, 0, 9, 12, 0, 119, 0, 90, 3, 80, 46, 27, 0, 1, 43, 0, 0, 134, 45, 0, 0, 4, 58, 1, 0, 46, 21, 31, 43, 78, 45, 21, 0, 1, 48, 15, 0, 1, 46, 69, 0, 138, 45, 48, 46, 20, 57, 0, 0, 4, 57, 0, 0, 4, 57, 0, 0, 4, 57, 0, 0, 4, 57, 0, 0, 4, 57, 0, 0, 4, 57, 0, 0, 4, 57, 0, 0, 4, 57, 0, 0, 4, 57, 0, 0, 4, 57, 0, 0, 4, 57, 0, 0, 4, 57, 0, 0, 4, 57, 0, 0, 4, 57, 0, 0, 4, 57, 0, 0, 4, 57, 0, 0, 4, 57, 0, 0, 4, 57, 0, 0, 4, 57, 0, 0, 4, 57, 0, 0, 4, 57, 0, 0, 4, 57, 0, 0, 4, 57, 0, 0, 4, 57, 0, 0, 4, 57, 0, 0, 4, 57, 0, 0, 4, 57, 0, 0, 4, 57, 0, 0, 4, 57, 0, 0, 4, 57, 0, 0, 4, 57, 0, 0, 4, 57, 0, 0, 4, 57, 0, 0, 4, 57, 0, 0, 4, 57, 0, 0, 4, 57, 0, 0, 4, 57, 0, 0, 4, 57, 0, 0, 4, 57, 0, 0, 4, 57, 0, 0, 4, 57, 0, 0, 4, 57, 0, 0, 4, 57, 0, 0, 4, 57, 0, 0, 4, 57, 0, 0, 88, 58, 0, 0, 4, 57, 0, 0, 4, 57, 0, 0, 4, 57, 0, 0, 4, 57, 0, 0, 4, 57, 0, 0, 4, 57, 0, 0, 4, 57, 0, 0, 4, 57, 0, 0, 4, 57, 0, 0, 96, 59, 0, 0, 140, 59, 0, 0, 4, 57, 0, 0, 4, 57, 0, 0, 188, 60, 0, 0, 4, 57, 0, 0, 244, 60, 0, 0, 4, 57, 0, 0, 44, 61, 0, 0, 88, 61, 0, 0, 4, 57, 0, 0, 4, 57, 0, 0, 132, 62, 0, 0, 0, 9, 12, 0, 0, 4, 7, 0, 0, 6, 11, 0, 119, 0, 8, 3, 82, 47, 18, 0, 120, 47, 5, 0, 0, 9, 12, 0, 0, 4, 7, 0, 0, 6, 11, 0, 119, 0, 2, 3, 82, 48, 16, 0, 13, 48, 48, 3, 125, 47, 48, 13, 3, 0, 0, 0, 82, 3, 47, 0, 0, 8, 3, 0, 25, 9, 8, 8, 25, 6, 9, 11, 78, 4, 6, 0, 41, 47, 4, 24, 42, 47, 47, 24, 34, 47, 47, 0, 121, 47, 3, 0, 106, 4, 8, 12, 119, 0, 4, 0, 1, 47, 255, 0, 19, 47, 4, 47, 0, 4, 47, 0, 120, 4, 5, 0, 0, 9, 12, 0, 0, 4, 7, 0, 0, 6, 11, 0, 119, 0, 235, 2, 80, 4, 22, 0, 19, 47, 4, 39, 57, 47, 2, 47, 196, 57, 0, 0, 1, 48, 8, 0, 135, 47, 94, 0, 48, 0, 0, 0, 1, 48, 32, 0, 135, 47, 94, 0, 48, 0, 0, 0, 1, 48, 8, 0, 135, 47, 94, 0, 48, 0, 0, 0, 26, 2, 2, 1, 119, 0, 242, 255, 78, 47, 6, 0, 34, 47, 47, 0, 121, 47, 3, 0, 82, 2, 9, 0, 119, 0, 2, 0, 0, 2, 9, 0, 19, 48, 4, 39, 3, 48, 1, 48, 135, 47, 95, 0, 48, 2, 0, 0, 78, 2, 6, 0, 41, 47, 2, 24, 42, 47, 47, 24, 34, 4, 47, 0, 121, 4, 3, 0, 106, 2, 8, 12, 119, 0, 4, 0, 1, 47, 255, 0, 19, 47, 2, 47, 0, 2, 47, 0, 84, 30, 2, 0, 19, 47, 2, 39, 81, 48, 22, 0, 3, 6, 47, 48, 121, 4, 3, 0, 82, 2, 9, 0, 119, 0, 2, 0, 0, 2, 9, 0, 1, 47, 1, 0, 1, 46, 0, 0, 135, 48, 7, 0, 47, 2, 30, 46, 0, 9, 12, 0, 1, 48, 254, 15, 4, 4, 48, 6, 0, 2, 6, 0, 119, 0, 183, 2, 82, 43, 17, 0, 120, 43, 5, 0, 0, 9, 12, 0, 0, 4, 7, 0, 0, 6, 11, 0, 119, 0, 177, 2, 82, 10, 14, 0, 0, 5, 10, 0, 45, 43, 10, 29, 144, 58, 0, 0, 0, 9, 12, 0, 0, 4, 7, 0, 0, 6, 11, 0, 119, 0, 169, 2, 25, 4, 10, 8, 25, 9, 4, 11, 78, 6, 9, 0, 41, 43, 6, 24, 42, 43, 43, 24, 34, 8, 43, 0, 121, 8, 3, 0, 106, 6, 10, 12, 119, 0, 4, 0, 1, 43, 255, 0, 19, 43, 6, 43, 0, 6, 43, 0, 50, 43, 6, 11, 216, 58, 0, 0, 0, 9, 12, 0, 0, 4, 7, 0, 0, 6, 11, 0, 119, 0, 151, 2, 121, 8, 2, 0, 82, 4, 4, 0, 3, 6, 4, 11, 78, 4, 6, 0, 83, 21, 4, 0, 41, 43, 4, 24, 42, 43, 43, 24, 120, 43, 2, 0, 119, 0, 9, 0, 95, 1, 2, 4, 1, 46, 1, 0, 1, 47, 0, 0, 135, 43, 7, 0, 46, 21, 31, 47, 25, 6, 6, 1, 25, 2, 2, 1, 119, 0, 243, 255, 78, 2, 9, 0, 41, 43, 2, 24, 42, 43, 43, 24, 34, 43, 43, 0, 121, 43, 3, 0, 106, 6, 10, 12, 119, 0, 4, 0, 1, 43, 255, 0, 19, 43, 2, 43, 0, 6, 43, 0, 1, 47, 0, 0, 95, 1, 6, 47, 0, 9, 12, 0, 1, 47, 254, 15, 4, 4, 47, 6, 0, 2, 6, 0, 119, 0, 117, 2, 120, 2, 6, 0, 0, 9, 12, 0, 0, 4, 7, 0, 1, 2, 0, 0, 0, 6, 11, 0, 119, 0, 111, 2, 1, 43, 8, 0, 135, 47, 94, 0, 43, 0, 0, 0, 26, 2, 2, 1, 119, 0, 246, 255, 0, 8, 5, 0, 82, 47, 17, 0, 32, 47, 47, 0, 13, 43, 29, 8, 20, 47, 47, 43, 121, 47, 5, 0, 0, 9, 12, 0, 0, 4, 7, 0, 0, 6, 11, 0, 119, 0, 96, 2, 82, 47, 14, 0, 14, 47, 47, 8, 20, 47, 12, 47, 121, 47, 3, 0, 0, 6, 12, 0, 119, 0, 16, 0, 1, 47, 0, 0, 85, 25, 47, 0, 1, 43, 0, 0, 109, 25, 4, 43, 1, 47, 0, 0, 109, 25, 8, 47, 135, 43, 96, 0, 1, 0, 0, 0, 135, 47, 97, 0, 25, 1, 43, 0, 135, 47, 98, 0, 29, 25, 0, 0, 135, 47, 99, 0, 25, 0, 0, 0, 1, 6, 1, 0, 120, 2, 2, 0, 119, 0, 12, 0, 1, 43, 8, 0, 135, 47, 94, 0, 43, 0, 0, 0, 1, 43, 32, 0, 135, 47, 94, 0, 43, 0, 0, 0, 1, 43, 8, 0, 135, 47, 94, 0, 43, 0, 0, 0, 26, 2, 2, 1, 119, 0, 244, 255, 25, 2, 5, 8, 25, 4, 2, 11, 78, 47, 4, 0, 34, 47, 47, 0, 121, 47, 2, 0, 82, 2, 2, 0, 135, 47, 95, 0, 1, 2, 0, 0, 78, 2, 4, 0, 41, 47, 2, 24, 42, 47, 47, 24, 34, 47, 47, 0, 121, 47, 3, 0, 106, 2, 5, 12, 119, 0, 4, 0, 1, 47, 255, 0, 19, 47, 2, 47, 0, 2, 47, 0, 84, 30, 2, 0, 19, 47, 2, 39, 0, 12, 47, 0, 1, 43, 1, 0, 1, 46, 0, 0, 135, 47, 7, 0, 43, 1, 30, 46, 0, 9, 6, 0, 106, 5, 8, 4, 1, 47, 254, 15, 4, 4, 47, 12, 0, 2, 12, 0, 0, 6, 12, 0, 119, 0, 30, 2, 120, 2, 6, 0, 0, 9, 12, 0, 0, 4, 7, 0, 1, 2, 0, 0, 0, 6, 11, 0, 119, 0, 24, 2, 1, 43, 8, 0, 135, 47, 94, 0, 43, 0, 0, 0, 0, 9, 12, 0, 0, 4, 7, 0, 26, 2, 2, 1, 0, 6, 11, 0, 119, 0, 16, 2, 50, 47, 11, 2, 12, 61, 0, 0, 0, 9, 12, 0, 0, 4, 7, 0, 0, 6, 11, 0, 119, 0, 10, 2, 90, 43, 1, 2, 135, 47, 94, 0, 43, 0, 0, 0, 0, 9, 12, 0, 0, 4, 7, 0, 25, 2, 2, 1, 0, 6, 11, 0, 119, 0, 2, 2, 50, 47, 11, 2, 68, 61, 0, 0, 0, 9, 12, 0, 0, 4, 7, 0, 0, 6, 11, 0, 119, 0, 252, 1, 90, 43, 1, 2, 135, 47, 94, 0, 43, 0, 0, 0, 25, 2, 2, 1, 119, 0, 246, 255, 82, 47, 17, 0, 120, 47, 5, 0, 0, 9, 12, 0, 0, 4, 7, 0, 0, 6, 11, 0, 119, 0, 241, 1, 82, 6, 14, 0, 45, 47, 6, 5, 140, 61, 0, 0, 0, 9, 12, 0, 0, 4, 7, 0, 0, 6, 11, 0, 119, 0, 234, 1, 82, 4, 5, 0, 45, 47, 4, 6, 200, 61, 0, 0, 106, 5, 6, 4, 120, 12, 5, 0, 1, 9, 0, 0, 0, 4, 7, 0, 0, 6, 11, 0, 119, 0, 225, 1, 135, 47, 100, 0, 29, 0, 0, 0, 1, 9, 0, 0, 0, 4, 7, 0, 0, 6, 11, 0, 119, 0, 219, 1, 82, 6, 4, 0, 120, 2, 2, 0, 119, 0, 12, 0, 1, 46, 8, 0, 135, 47, 94, 0, 46, 0, 0, 0, 1, 46, 32, 0, 135, 47, 94, 0, 46, 0, 0, 0, 1, 46, 8, 0, 135, 47, 94, 0, 46, 0, 0, 0, 26, 2, 2, 1, 119, 0, 244, 255, 0, 5, 6, 0, 25, 2, 5, 8, 25, 4, 2, 11, 78, 47, 4, 0, 34, 47, 47, 0, 121, 47, 2, 0, 82, 2, 2, 0, 135, 47, 95, 0, 1, 2, 0, 0, 78, 2, 4, 0, 41, 47, 2, 24, 42, 47, 47, 24, 34, 47, 47, 0, 121, 47, 3, 0, 106, 2, 5, 12, 119, 0, 4, 0, 1, 47, 255, 0, 19, 47, 2, 47, 0, 2, 47, 0, 84, 30, 2, 0, 19, 47, 2, 39, 0, 11, 47, 0, 1, 46, 1, 0, 1, 43, 0, 0, 135, 47, 7, 0, 46, 1, 30, 43, 0, 9, 12, 0, 106, 5, 6, 4, 1, 47, 254, 15, 4, 4, 47, 11, 0, 2, 11, 0, 0, 6, 11, 0, 119, 0, 172, 1, 50, 47, 11, 2, 156, 62, 0, 0, 0, 9, 12, 0, 0, 4, 7, 0, 0, 6, 11, 0, 119, 0, 166, 1, 4, 47, 39, 2, 3, 47, 47, 11, 84, 25, 47, 0, 1, 43, 1, 0, 25, 46, 2, 1, 3, 46, 1, 46, 1, 48, 0, 0, 135, 47, 7, 0, 43, 46, 25, 48, 1, 48, 32, 0, 135, 47, 94, 0, 48, 0, 0, 0, 1, 48, 8, 0, 135, 47, 94, 0, 48, 0, 0, 0, 26, 6, 11, 1, 0, 4, 2, 0, 57, 47, 6, 4, 8, 63, 0, 0, 25, 11, 4, 1, 90, 48, 1, 11, 95, 1, 4, 48, 1, 47, 8, 0, 135, 48, 94, 0, 47, 0, 0, 0, 0, 4, 11, 0, 119, 0, 247, 255, 1, 47, 0, 0, 95, 1, 6, 47, 0, 9, 12, 0, 25, 4, 7, 1, 119, 0, 134, 1, 120, 2, 5, 0, 0, 4, 7, 0, 1, 2, 0, 0, 0, 6, 11, 0, 119, 0, 48, 0, 1, 48, 8, 0, 135, 45, 94, 0, 48, 0, 0, 0, 4, 8, 11, 2, 25, 4, 7, 1, 26, 9, 2, 1, 3, 6, 1, 9, 120, 8, 5, 0, 1, 45, 0, 0, 83, 6, 45, 0, 26, 6, 11, 1, 119, 0, 21, 0, 3, 48, 1, 2, 135, 45, 101, 0, 6, 48, 8, 0, 26, 6, 11, 1, 1, 48, 0, 0, 95, 1, 6, 48, 19, 48, 9, 39, 0, 7, 48, 0, 19, 48, 7, 39, 0, 2, 48, 0, 57, 48, 6, 2, 176, 63, 0, 0, 90, 45, 1, 2, 135, 48, 94, 0, 45, 0, 0, 0, 25, 48, 7, 1, 41, 48, 48, 16, 42, 48, 48, 16, 0, 7, 48, 0, 119, 0, 245, 255, 1, 45, 32, 0, 135, 48, 94, 0, 45, 0, 0, 0, 1, 45, 8, 0, 135, 48, 94, 0, 45, 0, 0, 0, 0, 2, 8, 0, 120, 2, 3, 0, 0, 2, 9, 0, 119, 0, 6, 0, 1, 45, 8, 0, 135, 48, 94, 0, 45, 0, 0, 0, 26, 2, 2, 1, 119, 0, 249, 255, 82, 48, 18, 0, 120, 48, 3, 0, 0, 9, 12, 0, 119, 0, 78, 1, 135, 48, 93, 0, 28, 0, 0, 0, 0, 9, 12, 0, 119, 0, 74, 1, 82, 48, 18, 0, 120, 48, 224, 0, 2, 45, 0, 0, 142, 10, 4, 0, 1, 46, 3, 0, 135, 48, 102, 0, 1, 45, 46, 0, 32, 9, 48, 0, 1, 48, 32, 0, 135, 4, 103, 0, 1, 48, 0, 0, 120, 4, 5, 0, 1, 4, 0, 0, 0, 8, 1, 0, 1, 6, 0, 0, 119, 0, 8, 0, 25, 8, 4, 1, 135, 48, 69, 0, 8, 0, 0, 0, 4, 6, 11, 48, 0, 4, 6, 0, 19, 48, 6, 39, 0, 6, 48, 0, 84, 22, 6, 0, 19, 48, 4, 39, 3, 4, 1, 48, 1, 48, 92, 0, 135, 6, 103, 0, 4, 48, 0, 0, 121, 6, 5, 0, 3, 4, 34, 6, 84, 22, 4, 0, 19, 48, 4, 39, 3, 4, 1, 48, 1, 48, 47, 0, 135, 4, 103, 0, 4, 48, 0, 0, 121, 4, 3, 0, 3, 48, 34, 4, 84, 22, 48, 0, 120, 8, 5, 0, 2, 48, 0, 0, 42, 46, 42, 0, 85, 25, 48, 0, 119, 0, 46, 0, 135, 48, 95, 0, 25, 8, 0, 0, 1, 48, 46, 0, 135, 6, 103, 0, 25, 48, 0, 0, 1, 48, 92, 0, 135, 10, 103, 0, 25, 48, 0, 0, 1, 48, 58, 0, 135, 4, 103, 0, 25, 48, 0, 0, 1, 48, 0, 0, 4, 46, 6, 10, 47, 48, 48, 46, 72, 65, 0, 0, 1, 48, 0, 0, 1, 45, 47, 0, 135, 46, 103, 0, 25, 45, 0, 0, 4, 46, 6, 46, 47, 48, 48, 46, 72, 65, 0, 0, 1, 48, 0, 0, 4, 46, 6, 4, 47, 48, 48, 46, 72, 65, 0, 0, 135, 48, 69, 0, 25, 0, 0, 0, 3, 10, 25, 48, 1, 48, 42, 0, 83, 10, 48, 0, 1, 46, 0, 0, 107, 10, 1, 46, 119, 0, 12, 0, 135, 46, 69, 0, 25, 0, 0, 0, 3, 10, 25, 46, 1, 46, 42, 0, 83, 10, 46, 0, 1, 48, 46, 0, 107, 10, 1, 48, 1, 46, 42, 0, 107, 10, 2, 46, 1, 48, 0, 0, 107, 10, 3, 48, 2, 48, 0, 0, 136, 72, 118, 1, 135, 6, 46, 0, 48, 0, 0, 0, 2, 46, 0, 0, 136, 72, 118, 1, 2, 45, 0, 0, 168, 72, 118, 1, 82, 45, 45, 0, 135, 48, 31, 0, 46, 45, 0, 0, 1, 45, 247, 255, 1, 46, 0, 0, 135, 48, 73, 0, 25, 45, 46, 0, 120, 48, 9, 0, 2, 46, 0, 0, 136, 72, 118, 1, 135, 48, 31, 0, 46, 6, 0, 0, 0, 9, 12, 0, 0, 4, 7, 0, 0, 6, 11, 0, 119, 0, 216, 0, 2, 45, 0, 0, 136, 72, 118, 1, 135, 46, 46, 0, 45, 0, 0, 0, 135, 48, 104, 0, 24, 46, 0, 0, 85, 26, 26, 0, 85, 15, 26, 0, 1, 48, 0, 0, 85, 19, 48, 0, 135, 48, 105, 0, 24, 32, 35, 23, 36, 20, 0, 0, 2, 46, 0, 0, 179, 114, 4, 0, 135, 48, 106, 0, 32, 46, 0, 0, 121, 48, 68, 0, 2, 46, 0, 0, 190, 60, 4, 0, 135, 48, 106, 0, 32, 46, 0, 0, 121, 48, 63, 0, 121, 9, 20, 0, 78, 48, 20, 0, 38, 48, 48, 16, 120, 48, 2, 0, 119, 0, 58, 0, 1, 48, 0, 0, 85, 33, 48, 0, 1, 46, 0, 0, 109, 33, 4, 46, 1, 48, 0, 0, 109, 33, 8, 48, 135, 46, 96, 0, 32, 0, 0, 0, 135, 48, 97, 0, 33, 32, 46, 0, 135, 48, 107, 0, 28, 33, 0, 0, 135, 48, 99, 0, 33, 0, 0, 0, 119, 0, 43, 0, 1, 48, 46, 0, 135, 3, 103, 0, 32, 48, 0, 0, 121, 3, 25, 0, 135, 48, 106, 0, 3, 40, 0, 0, 121, 48, 7, 0, 135, 48, 106, 0, 3, 41, 0, 0, 121, 48, 4, 0, 135, 48, 106, 0, 3, 42, 0, 0, 120, 48, 16, 0, 1, 48, 0, 0, 85, 33, 48, 0, 1, 46, 0, 0, 109, 33, 4, 46, 1, 48, 0, 0, 109, 33, 8, 48, 135, 46, 96, 0, 32, 0, 0, 0, 135, 48, 97, 0, 33, 32, 46, 0, 135, 48, 98, 0, 26, 33, 0, 0, 135, 48, 99, 0, 33, 0, 0, 0, 119, 0, 15, 0, 1, 48, 0, 0, 85, 33, 48, 0, 1, 46, 0, 0, 109, 33, 4, 46, 1, 48, 0, 0, 109, 33, 8, 48, 135, 46, 96, 0, 32, 0, 0, 0, 135, 48, 97, 0, 33, 32, 46, 0, 135, 48, 107, 0, 28, 33, 0, 0, 135, 48, 99, 0, 33, 0, 0, 0, 135, 48, 74, 0, 120, 48, 180, 255, 82, 4, 15, 0, 0, 3, 4, 0, 52, 48, 3, 26, 92, 67, 0, 0, 25, 46, 4, 8, 135, 48, 98, 0, 28, 46, 0, 0, 106, 10, 3, 4, 0, 3, 10, 0, 0, 4, 10, 0, 119, 0, 248, 255, 82, 3, 16, 0, 2, 46, 0, 0, 136, 72, 118, 1, 135, 48, 31, 0, 46, 6, 0, 0, 135, 48, 108, 0, 26, 0, 0, 0, 82, 48, 18, 0, 120, 48, 9, 0, 0, 9, 12, 0, 0, 4, 7, 0, 0, 6, 11, 0, 119, 0, 105, 0, 106, 3, 3, 4, 45, 48, 28, 3, 160, 67, 0, 0, 82, 3, 16, 0, 0, 8, 3, 0, 25, 9, 8, 8, 25, 6, 9, 11, 78, 4, 6, 0, 41, 48, 4, 24, 42, 48, 48, 24, 34, 48, 48, 0, 121, 48, 3, 0, 106, 4, 8, 12, 119, 0, 4, 0, 1, 48, 255, 0, 19, 48, 4, 48, 0, 4, 48, 0, 120, 4, 5, 0, 0, 9, 12, 0, 0, 4, 7, 0, 0, 6, 11, 0, 119, 0, 83, 0, 80, 4, 22, 0, 19, 48, 4, 39, 57, 48, 2, 48, 36, 68, 0, 0, 1, 46, 8, 0, 135, 48, 94, 0, 46, 0, 0, 0, 1, 46, 32, 0, 135, 48, 94, 0, 46, 0, 0, 0, 1, 46, 8, 0, 135, 48, 94, 0, 46, 0, 0, 0, 26, 2, 2, 1, 119, 0, 242, 255, 78, 48, 6, 0, 34, 48, 48, 0, 121, 48, 3, 0, 82, 2, 9, 0, 119, 0, 2, 0, 0, 2, 9, 0, 19, 46, 4, 39, 3, 46, 1, 46, 135, 48, 95, 0, 46, 2, 0, 0, 78, 2, 6, 0, 41, 48, 2, 24, 42, 48, 48, 24, 34, 4, 48, 0, 121, 4, 3, 0, 106, 2, 8, 12, 119, 0, 4, 0, 1, 48, 255, 0, 19, 48, 2, 48, 0, 2, 48, 0, 84, 30, 2, 0, 19, 48, 2, 39, 81, 46, 22, 0, 3, 6, 48, 46, 121, 4, 3, 0, 82, 2, 9, 0, 119, 0, 2, 0, 0, 2, 9, 0, 1, 48, 1, 0, 1, 45, 0, 0, 135, 46, 7, 0, 48, 2, 30, 45, 0, 9, 12, 0, 1, 46, 254, 15, 4, 4, 46, 6, 0, 2, 6, 0, 119, 0, 31, 0, 0, 9, 12, 0, 0, 4, 7, 0, 0, 6, 11, 0, 119, 0, 27, 0, 1, 45, 10, 0, 135, 48, 94, 0, 45, 0, 0, 0, 0, 9, 12, 0, 1, 4, 0, 0, 0, 6, 11, 0, 119, 0, 20, 0, 1, 45, 92, 0, 135, 46, 94, 0, 45, 0, 0, 0, 1, 45, 10, 0, 135, 46, 94, 0, 45, 0, 0, 0, 1, 46, 0, 0, 83, 1, 46, 0, 82, 46, 18, 0, 121, 46, 3, 0, 135, 46, 93, 0, 28, 0, 0, 0, 134, 46, 0, 0, 4, 53, 0, 0, 0, 1, 0, 0, 0, 9, 12, 0, 1, 4, 0, 0, 1, 6, 0, 0, 119, 0, 1, 0, 0, 12, 9, 0, 0, 11, 6, 0, 119, 0, 43, 252, 121, 11, 22, 0, 121, 12, 3, 0, 135, 44, 100, 0, 29, 0, 0, 0, 1, 44, 0, 0, 85, 25, 44, 0, 1, 48, 0, 0, 109, 25, 4, 48, 1, 44, 0, 0, 109, 25, 8, 44, 135, 48, 96, 0, 1, 0, 0, 0, 135, 44, 97, 0, 25, 1, 48, 0, 135, 44, 98, 0, 29, 25, 0, 0, 135, 44, 99, 0, 25, 0, 0, 0, 82, 44, 18, 0, 121, 44, 3, 0, 135, 44, 93, 0, 28, 0, 0, 0, 137, 38, 0, 0, 139, 0, 0, 0, 140, 1, 25, 0, 0, 0, 0, 0, 2, 15, 0, 0, 226, 14, 13, 0, 2, 16, 0, 0, 255, 0, 0, 0, 2, 17, 0, 0, 0, 0, 1, 0, 1, 12, 0, 0, 136, 18, 0, 0, 0, 13, 18, 0, 136, 18, 0, 0, 1, 19, 208, 0, 3, 18, 18, 19, 137, 18, 0, 0, 1, 18, 176, 0, 3, 7, 13, 18, 1, 18, 168, 0, 3, 6, 13, 18, 1, 18, 160, 0, 3, 5, 13, 18, 1, 18, 152, 0, 3, 4, 13, 18, 1, 18, 192, 0, 3, 8, 13, 18, 1, 18, 180, 0, 3, 9, 13, 18, 0, 10, 13, 0, 25, 11, 13, 104, 1, 19, 124, 3, 1, 20, 0, 0, 135, 18, 109, 0, 0, 19, 20, 0, 2, 18, 0, 0, 160, 59, 52, 0, 1, 20, 0, 0, 83, 18, 20, 0, 2, 20, 0, 0, 80, 46, 203, 1, 1, 18, 0, 0, 83, 20, 18, 0, 1, 18, 0, 0, 85, 8, 18, 0, 1, 20, 0, 0, 109, 8, 4, 20, 1, 18, 0, 0, 109, 8, 8, 18, 2, 20, 0, 0, 174, 84, 4, 0, 2, 21, 0, 0, 174, 84, 4, 0, 135, 19, 96, 0, 21, 0, 0, 0, 135, 18, 97, 0, 8, 20, 19, 0, 135, 18, 110, 0, 0, 8, 0, 0, 38, 18, 18, 1, 0, 1, 18, 0, 2, 18, 0, 0, 144, 59, 52, 0, 83, 18, 1, 0, 135, 18, 99, 0, 8, 0, 0, 0, 1, 18, 0, 0, 85, 8, 18, 0, 1, 19, 0, 0, 109, 8, 4, 19, 1, 18, 0, 0, 109, 8, 8, 18, 2, 19, 0, 0, 238, 87, 4, 0, 2, 21, 0, 0, 238, 87, 4, 0, 135, 20, 96, 0, 21, 0, 0, 0, 135, 18, 97, 0, 8, 19, 20, 0, 135, 18, 110, 0, 0, 8, 0, 0, 135, 18, 99, 0, 8, 0, 0, 0, 1, 18, 0, 0, 85, 8, 18, 0, 1, 20, 0, 0, 109, 8, 4, 20, 1, 18, 0, 0, 109, 8, 8, 18, 2, 20, 0, 0, 50, 88, 4, 0, 2, 21, 0, 0, 50, 88, 4, 0, 135, 19, 96, 0, 21, 0, 0, 0, 135, 18, 97, 0, 8, 20, 19, 0, 135, 1, 111, 0, 0, 8, 0, 0, 135, 18, 99, 0, 8, 0, 0, 0, 135, 2, 112, 0, 1, 0, 0, 0, 1, 18, 0, 0, 85, 9, 18, 0, 1, 19, 0, 0, 109, 9, 4, 19, 1, 18, 0, 0, 109, 9, 8, 18, 2, 19, 0, 0, 220, 88, 4, 0, 2, 21, 0, 0, 220, 88, 4, 0, 135, 20, 96, 0, 21, 0, 0, 0, 135, 18, 97, 0, 9, 19, 20, 0, 135, 2, 113, 0, 2, 9, 0, 0, 1, 18, 0, 0, 85, 8, 18, 0, 1, 20, 0, 0, 109, 8, 4, 20, 1, 18, 0, 0, 109, 8, 8, 18, 135, 20, 96, 0, 2, 0, 0, 0, 135, 18, 97, 0, 8, 2, 20, 0, 135, 18, 99, 0, 9, 0, 0, 0, 135, 1, 112, 0, 1, 0, 0, 0, 1, 18, 0, 0, 85, 10, 18, 0, 1, 20, 0, 0, 109, 10, 4, 20, 1, 18, 0, 0, 109, 10, 8, 18, 2, 20, 0, 0, 234, 88, 4, 0, 2, 21, 0, 0, 234, 88, 4, 0, 135, 19, 96, 0, 21, 0, 0, 0, 135, 18, 97, 0, 10, 20, 19, 0, 135, 1, 113, 0, 1, 10, 0, 0, 1, 18, 0, 0, 85, 9, 18, 0, 1, 19, 0, 0, 109, 9, 4, 19, 1, 18, 0, 0, 109, 9, 8, 18, 135, 19, 96, 0, 1, 0, 0, 0, 135, 18, 97, 0, 9, 1, 19, 0, 135, 18, 99, 0, 10, 0, 0, 0, 2, 18, 0, 0, 199, 89, 4, 0, 135, 1, 96, 0, 18, 0, 0, 0, 25, 2, 8, 11, 78, 14, 2, 0, 25, 3, 8, 4, 41, 19, 14, 24, 42, 19, 19, 24, 34, 19, 19, 0, 121, 19, 4, 0, 82, 19, 3, 0, 0, 18, 19, 0, 119, 0, 3, 0, 19, 19, 14, 16, 0, 18, 19, 0, 45, 18, 1, 18, 140, 72, 0, 0, 1, 19, 0, 0, 1, 20, 255, 255, 2, 21, 0, 0, 199, 89, 4, 0, 135, 18, 114, 0, 8, 19, 20, 21, 1, 0, 0, 0, 121, 18, 4, 0, 1, 12, 3, 0, 119, 0, 2, 0, 1, 12, 3, 0, 32, 18, 12, 3, 121, 18, 99, 0, 2, 18, 0, 0, 206, 89, 4, 0, 135, 1, 96, 0, 18, 0, 0, 0, 78, 14, 2, 0, 41, 21, 14, 24, 42, 21, 21, 24, 34, 21, 21, 0, 121, 21, 4, 0, 82, 21, 3, 0, 0, 18, 21, 0, 119, 0, 3, 0, 19, 21, 14, 16, 0, 18, 21, 0, 45, 18, 1, 18, 252, 72, 0, 0, 1, 21, 0, 0, 1, 20, 255, 255, 2, 19, 0, 0, 206, 89, 4, 0, 135, 18, 114, 0, 8, 21, 20, 19, 1, 0, 0, 0, 120, 18, 2, 0, 119, 0, 74, 0, 2, 18, 0, 0, 243, 88, 4, 0, 135, 1, 96, 0, 18, 0, 0, 0, 78, 14, 2, 0, 41, 19, 14, 24, 42, 19, 19, 24, 34, 19, 19, 0, 121, 19, 4, 0, 82, 19, 3, 0, 0, 18, 19, 0, 119, 0, 3, 0, 19, 19, 14, 16, 0, 18, 19, 0, 45, 18, 1, 18, 96, 73, 0, 0, 1, 19, 0, 0, 1, 20, 255, 255, 2, 21, 0, 0, 243, 88, 4, 0, 135, 18, 114, 0, 8, 19, 20, 21, 1, 0, 0, 0, 120, 18, 2, 0, 119, 0, 49, 0, 2, 18, 0, 0, 227, 88, 4, 0, 135, 1, 96, 0, 18, 0, 0, 0, 78, 14, 2, 0, 41, 21, 14, 24, 42, 21, 21, 24, 34, 21, 21, 0, 121, 21, 4, 0, 82, 21, 3, 0, 0, 18, 21, 0, 119, 0, 3, 0, 19, 21, 14, 16, 0, 18, 21, 0, 45, 18, 1, 18, 196, 73, 0, 0, 1, 21, 0, 0, 1, 20, 255, 255, 2, 19, 0, 0, 227, 88, 4, 0, 135, 18, 114, 0, 8, 21, 20, 19, 1, 0, 0, 0, 120, 18, 2, 0, 119, 0, 24, 0, 2, 18, 0, 0, 212, 89, 4, 0, 135, 1, 96, 0, 18, 0, 0, 0, 78, 14, 2, 0, 41, 19, 14, 24, 42, 19, 19, 24, 34, 19, 19, 0, 121, 19, 4, 0, 82, 19, 3, 0, 0, 18, 19, 0, 119, 0, 3, 0, 19, 19, 14, 16, 0, 18, 19, 0, 45, 18, 1, 18, 32, 74, 0, 0, 1, 19, 0, 0, 1, 20, 255, 255, 2, 21, 0, 0, 212, 89, 4, 0, 135, 18, 114, 0, 8, 19, 20, 21, 1, 0, 0, 0, 2, 18, 0, 0, 199, 89, 4, 0, 135, 1, 96, 0, 18, 0, 0, 0, 25, 2, 9, 11, 78, 14, 2, 0, 25, 3, 9, 4, 41, 21, 14, 24, 42, 21, 21, 24, 34, 21, 21, 0, 121, 21, 4, 0, 82, 21, 3, 0, 0, 18, 21, 0, 119, 0, 3, 0, 19, 21, 14, 16, 0, 18, 21, 0, 45, 18, 1, 18, 164, 74, 0, 0, 1, 21, 0, 0, 1, 20, 255, 255, 2, 19, 0, 0, 199, 89, 4, 0, 135, 18, 114, 0, 9, 21, 20, 19, 1, 0, 0, 0, 120, 18, 6, 0, 2, 18, 0, 0, 248, 59, 52, 0, 1, 19, 1, 0, 85, 18, 19, 0, 119, 0, 4, 0, 1, 12, 14, 0, 119, 0, 2, 0, 1, 12, 14, 0, 32, 19, 12, 14, 121, 19, 145, 0, 2, 19, 0, 0, 206, 89, 4, 0, 135, 1, 96, 0, 19, 0, 0, 0, 78, 14, 2, 0, 41, 18, 14, 24, 42, 18, 18, 24, 34, 18, 18, 0, 121, 18, 4, 0, 82, 18, 3, 0, 0, 19, 18, 0, 119, 0, 3, 0, 19, 18, 14, 16, 0, 19, 18, 0, 45, 19, 1, 19, 36, 75, 0, 0, 1, 18, 0, 0, 1, 20, 255, 255, 2, 21, 0, 0, 206, 89, 4, 0, 135, 19, 114, 0, 9, 18, 20, 21, 1, 0, 0, 0, 120, 19, 6, 0, 2, 19, 0, 0, 248, 59, 52, 0, 1, 21, 2, 0, 85, 19, 21, 0, 119, 0, 116, 0, 2, 21, 0, 0, 243, 88, 4, 0, 135, 1, 96, 0, 21, 0, 0, 0, 78, 14, 2, 0, 41, 19, 14, 24, 42, 19, 19, 24, 34, 19, 19, 0, 121, 19, 4, 0, 82, 19, 3, 0, 0, 21, 19, 0, 119, 0, 3, 0, 19, 19, 14, 16, 0, 21, 19, 0, 45, 21, 1, 21, 152, 75, 0, 0, 1, 19, 0, 0, 1, 20, 255, 255, 2, 18, 0, 0, 243, 88, 4, 0, 135, 21, 114, 0, 9, 19, 20, 18, 1, 0, 0, 0, 120, 21, 6, 0, 2, 21, 0, 0, 248, 59, 52, 0, 1, 18, 3, 0, 85, 21, 18, 0, 119, 0, 87, 0, 2, 18, 0, 0, 227, 88, 4, 0, 135, 1, 96, 0, 18, 0, 0, 0, 78, 14, 2, 0, 41, 21, 14, 24, 42, 21, 21, 24, 34, 21, 21, 0, 121, 21, 4, 0, 82, 21, 3, 0, 0, 18, 21, 0, 119, 0, 3, 0, 19, 21, 14, 16, 0, 18, 21, 0, 45, 18, 1, 18, 12, 76, 0, 0, 1, 21, 0, 0, 1, 20, 255, 255, 2, 19, 0, 0, 227, 88, 4, 0, 135, 18, 114, 0, 9, 21, 20, 19, 1, 0, 0, 0, 120, 18, 6, 0, 2, 18, 0, 0, 248, 59, 52, 0, 1, 19, 4, 0, 85, 18, 19, 0, 119, 0, 58, 0, 2, 19, 0, 0, 212, 89, 4, 0, 135, 1, 96, 0, 19, 0, 0, 0, 78, 14, 2, 0, 41, 18, 14, 24, 42, 18, 18, 24, 34, 18, 18, 0, 121, 18, 4, 0, 82, 18, 3, 0, 0, 19, 18, 0, 119, 0, 3, 0, 19, 18, 14, 16, 0, 19, 18, 0, 45, 19, 1, 19, 128, 76, 0, 0, 1, 18, 0, 0, 1, 20, 255, 255, 2, 21, 0, 0, 212, 89, 4, 0, 135, 19, 114, 0, 9, 18, 20, 21, 1, 0, 0, 0, 120, 19, 6, 0, 2, 19, 0, 0, 248, 59, 52, 0, 1, 21, 5, 0, 85, 19, 21, 0, 119, 0, 29, 0, 2, 21, 0, 0, 220, 89, 4, 0, 135, 1, 96, 0, 21, 0, 0, 0, 78, 14, 2, 0, 41, 19, 14, 24, 42, 19, 19, 24, 34, 19, 19, 0, 121, 19, 4, 0, 82, 19, 3, 0, 0, 21, 19, 0, 119, 0, 3, 0, 19, 19, 14, 16, 0, 21, 19, 0, 45, 21, 1, 21, 240, 76, 0, 0, 1, 19, 0, 0, 1, 20, 255, 255, 2, 18, 0, 0, 220, 89, 4, 0, 135, 21, 114, 0, 9, 19, 20, 18, 1, 0, 0, 0, 120, 21, 5, 0, 2, 21, 0, 0, 248, 59, 52, 0, 1, 18, 0, 0, 85, 21, 18, 0, 2, 18, 0, 0, 232, 59, 52, 0, 1, 21, 0, 0, 83, 18, 21, 0, 2, 21, 0, 0, 148, 46, 203, 1, 1, 18, 0, 0, 83, 21, 18, 0, 2, 18, 0, 0, 82, 46, 203, 1, 1, 21, 0, 0, 83, 18, 21, 0, 2, 21, 0, 0, 96, 43, 203, 1, 1, 18, 0, 0, 83, 21, 18, 0, 1, 18, 0, 0, 85, 10, 18, 0, 1, 21, 0, 0, 109, 10, 4, 21, 1, 18, 0, 0, 109, 10, 8, 18, 2, 21, 0, 0, 152, 85, 4, 0, 2, 19, 0, 0, 152, 85, 4, 0, 135, 20, 96, 0, 19, 0, 0, 0, 135, 18, 97, 0, 10, 21, 20, 0, 135, 1, 113, 0, 0, 10, 0, 0, 135, 18, 99, 0, 10, 0, 0, 0, 2, 18, 0, 0, 184, 59, 52, 0, 1, 20, 0, 0, 84, 18, 20, 0, 2, 20, 0, 0, 200, 59, 52, 0, 1, 18, 0, 0, 84, 20, 18, 0, 121, 1, 51, 0, 78, 18, 1, 0, 121, 18, 49, 0, 1, 20, 99, 0, 135, 18, 115, 0, 10, 1, 20, 0, 1, 20, 0, 0, 107, 10, 99, 20, 135, 1, 116, 0, 10, 0, 0, 0, 2, 18, 0, 0, 200, 86, 4, 0, 135, 20, 106, 0, 1, 18, 0, 0, 121, 20, 37, 0, 2, 20, 0, 0, 96, 43, 203, 1, 1, 18, 1, 0, 83, 20, 18, 0, 2, 20, 0, 0, 234, 89, 4, 0, 135, 18, 106, 0, 1, 20, 0, 0, 121, 18, 28, 0, 1, 18, 120, 0, 135, 1, 117, 0, 1, 18, 0, 0, 121, 1, 24, 0, 78, 18, 1, 0, 121, 18, 22, 0, 1, 18, 0, 0, 83, 1, 18, 0, 25, 20, 1, 1, 135, 18, 118, 0, 20, 0, 0, 0, 2, 20, 0, 0, 255, 255, 0, 0, 19, 18, 18, 20, 0, 14, 18, 0, 2, 18, 0, 0, 200, 59, 52, 0, 84, 18, 14, 0, 135, 18, 118, 0, 10, 0, 0, 0, 2, 20, 0, 0, 255, 255, 0, 0, 19, 18, 18, 20, 0, 14, 18, 0, 2, 18, 0, 0, 184, 59, 52, 0, 84, 18, 14, 0, 1, 18, 0, 0, 85, 10, 18, 0, 1, 20, 0, 0, 109, 10, 4, 20, 1, 18, 0, 0, 109, 10, 8, 18, 2, 20, 0, 0, 183, 86, 4, 0, 2, 19, 0, 0, 183, 86, 4, 0, 135, 21, 96, 0, 19, 0, 0, 0, 135, 18, 97, 0, 10, 20, 21, 0, 135, 1, 113, 0, 0, 10, 0, 0, 135, 18, 99, 0, 10, 0, 0, 0, 121, 1, 23, 0, 78, 18, 1, 0, 121, 18, 21, 0, 1, 21, 99, 0, 135, 18, 115, 0, 10, 1, 21, 0, 1, 21, 0, 0, 107, 10, 99, 21, 135, 1, 116, 0, 10, 0, 0, 0, 2, 18, 0, 0, 200, 86, 4, 0, 135, 21, 106, 0, 1, 18, 0, 0, 121, 21, 9, 0, 1, 21, 120, 0, 135, 1, 117, 0, 1, 21, 0, 0, 121, 1, 5, 0, 78, 21, 1, 0, 121, 21, 3, 0, 1, 21, 0, 0, 83, 1, 21, 0, 1, 21, 0, 0, 85, 10, 21, 0, 1, 18, 0, 0, 109, 10, 4, 18, 1, 21, 0, 0, 109, 10, 8, 21, 2, 18, 0, 0, 251, 84, 4, 0, 2, 19, 0, 0, 251, 84, 4, 0, 135, 20, 96, 0, 19, 0, 0, 0, 135, 21, 97, 0, 10, 18, 20, 0, 135, 21, 110, 0, 0, 10, 0, 0, 135, 21, 99, 0, 10, 0, 0, 0, 2, 21, 0, 0, 184, 59, 52, 0, 80, 21, 21, 0, 33, 21, 21, 0, 2, 20, 0, 0, 200, 59, 52, 0, 80, 20, 20, 0, 33, 20, 20, 0, 19, 21, 21, 20, 120, 21, 39, 0, 135, 1, 119, 0, 120, 1, 5, 0, 2, 21, 0, 0, 184, 59, 52, 0, 80, 1, 21, 0, 119, 0, 14, 0, 106, 21, 1, 12, 2, 20, 0, 0, 255, 255, 0, 0, 19, 21, 21, 20, 0, 14, 21, 0, 2, 21, 0, 0, 184, 59, 52, 0, 84, 21, 14, 0, 2, 21, 0, 0, 200, 59, 52, 0, 106, 20, 1, 16, 84, 21, 20, 0, 0, 1, 14, 0, 41, 20, 1, 16, 42, 20, 20, 16, 120, 20, 9, 0, 2, 21, 0, 0, 242, 89, 4, 0, 135, 20, 45, 0, 21, 4, 0, 0, 2, 20, 0, 0, 184, 59, 52, 0, 1, 21, 0, 4, 84, 20, 21, 0, 2, 21, 0, 0, 200, 59, 52, 0, 80, 21, 21, 0, 120, 21, 5, 0], eb + 10240);
  HEAPU8.set([2, 21, 0, 0, 200, 59, 52, 0, 1, 20, 0, 3, 84, 21, 20, 0, 1, 20, 0, 0, 85, 10, 20, 0, 1, 21, 0, 0, 109, 10, 4, 21, 1, 20, 0, 0, 109, 10, 8, 20, 2, 21, 0, 0, 112, 87, 4, 0, 2, 19, 0, 0, 112, 87, 4, 0, 135, 18, 96, 0, 19, 0, 0, 0, 135, 20, 97, 0, 10, 21, 18, 0, 135, 20, 110, 0, 0, 10, 0, 0, 38, 20, 20, 1, 0, 14, 20, 0, 2, 20, 0, 0, 216, 59, 52, 0, 83, 20, 14, 0, 135, 20, 99, 0, 10, 0, 0, 0, 2, 20, 0, 0, 216, 59, 52, 0, 78, 20, 20, 0, 120, 20, 8, 0, 1, 18, 0, 0, 135, 20, 120, 0, 18, 0, 0, 0, 2, 20, 0, 0, 216, 59, 52, 0, 78, 1, 20, 0, 119, 0, 2, 0, 1, 1, 1, 0, 2, 20, 0, 0, 149, 46, 203, 1, 83, 20, 1, 0, 2, 20, 0, 0, 224, 59, 52, 0, 1, 18, 0, 0, 83, 20, 18, 0, 1, 18, 0, 0, 85, 10, 18, 0, 1, 20, 0, 0, 109, 10, 4, 20, 1, 18, 0, 0, 109, 10, 8, 18, 2, 20, 0, 0, 207, 87, 4, 0, 2, 19, 0, 0, 207, 87, 4, 0, 135, 21, 96, 0, 19, 0, 0, 0, 135, 18, 97, 0, 10, 20, 21, 0, 135, 14, 121, 0, 0, 10, 0, 0, 2, 18, 0, 0, 0, 60, 52, 0, 85, 18, 14, 0, 135, 18, 99, 0, 10, 0, 0, 0, 1, 18, 0, 0, 85, 11, 18, 0, 1, 21, 0, 0, 109, 11, 4, 21, 1, 18, 0, 0, 109, 11, 8, 18, 2, 21, 0, 0, 60, 87, 4, 0, 2, 19, 0, 0, 60, 87, 4, 0, 135, 20, 96, 0, 19, 0, 0, 0, 135, 18, 97, 0, 11, 21, 20, 0, 135, 14, 113, 0, 0, 11, 0, 0, 1, 18, 0, 0, 85, 10, 18, 0, 1, 20, 0, 0, 109, 10, 4, 20, 1, 18, 0, 0, 109, 10, 8, 18, 135, 20, 96, 0, 14, 0, 0, 0, 135, 18, 97, 0, 10, 14, 20, 0, 135, 18, 99, 0, 11, 0, 0, 0, 2, 18, 0, 0, 144, 59, 52, 0, 78, 18, 18, 0, 121, 18, 2, 0, 135, 18, 122, 0, 2, 18, 0, 0, 67, 87, 4, 0, 135, 2, 96, 0, 18, 0, 0, 0, 25, 3, 10, 11, 78, 1, 3, 0, 25, 4, 10, 4, 41, 20, 1, 24, 42, 20, 20, 24, 34, 20, 20, 0, 121, 20, 4, 0, 82, 20, 4, 0, 0, 18, 20, 0, 119, 0, 3, 0, 19, 20, 1, 16, 0, 18, 20, 0, 45, 18, 2, 18, 4, 82, 0, 0, 1, 20, 0, 0, 1, 21, 255, 255, 2, 19, 0, 0, 67, 87, 4, 0, 135, 18, 114, 0, 10, 20, 21, 19, 2, 0, 0, 0, 121, 18, 5, 0, 78, 1, 3, 0, 1, 12, 59, 0, 119, 0, 2, 0, 1, 12, 59, 0, 32, 18, 12, 59, 121, 18, 14, 0, 41, 19, 1, 24, 42, 19, 19, 24, 34, 19, 19, 0, 121, 19, 4, 0, 82, 19, 10, 0, 0, 18, 19, 0, 119, 0, 2, 0, 0, 18, 10, 0, 85, 5, 18, 0, 2, 19, 0, 0, 124, 90, 4, 0, 135, 18, 45, 0, 19, 5, 0, 0, 1, 18, 128, 2, 1, 19, 144, 1, 1, 21, 0, 0, 1, 20, 0, 0, 135, 1, 123, 0, 18, 19, 21, 20, 2, 20, 0, 0, 136, 59, 52, 0, 85, 20, 1, 0, 120, 1, 7, 0, 135, 14, 124, 0, 85, 6, 14, 0, 2, 21, 0, 0, 185, 90, 4, 0, 135, 20, 11, 0, 21, 6, 0, 0, 106, 20, 1, 4, 102, 14, 20, 8, 2, 20, 0, 0, 78, 46, 203, 1, 83, 20, 14, 0, 41, 20, 14, 24, 42, 20, 20, 24, 32, 20, 20, 24, 121, 20, 5, 0, 2, 21, 0, 0, 216, 90, 4, 0, 135, 20, 45, 0, 21, 7, 0, 0, 135, 20, 125, 0, 2, 21, 0, 0, 25, 91, 4, 0, 2, 19, 0, 0, 32, 91, 4, 0, 135, 20, 126, 0, 21, 19, 0, 0, 2, 20, 0, 0, 38, 91, 4, 0, 135, 1, 96, 0, 20, 0, 0, 0, 78, 14, 3, 0, 41, 19, 14, 24, 42, 19, 19, 24, 34, 19, 19, 0, 121, 19, 4, 0, 82, 19, 4, 0, 0, 20, 19, 0, 119, 0, 3, 0, 19, 19, 14, 16, 0, 20, 19, 0, 45, 20, 1, 20, 60, 83, 0, 0, 1, 19, 0, 0, 1, 21, 255, 255, 2, 18, 0, 0, 38, 91, 4, 0, 135, 20, 114, 0, 10, 19, 21, 18, 1, 0, 0, 0, 121, 20, 4, 0, 1, 12, 66, 0, 119, 0, 2, 0, 1, 12, 66, 0, 32, 20, 12, 66, 121, 20, 243, 0, 2, 20, 0, 0, 46, 91, 4, 0, 135, 1, 96, 0, 20, 0, 0, 0, 78, 14, 3, 0, 41, 18, 14, 24, 42, 18, 18, 24, 34, 18, 18, 0, 121, 18, 4, 0, 82, 18, 4, 0, 0, 20, 18, 0, 119, 0, 3, 0, 19, 18, 14, 16, 0, 20, 18, 0, 45, 20, 1, 20, 172, 83, 0, 0, 1, 18, 0, 0, 1, 21, 255, 255, 2, 19, 0, 0, 46, 91, 4, 0, 135, 20, 114, 0, 10, 18, 21, 19, 1, 0, 0, 0, 120, 20, 2, 0, 119, 0, 218, 0, 1, 20, 0, 0, 1, 19, 128, 2, 1, 21, 144, 1, 1, 18, 32, 0, 2, 22, 0, 0, 0, 255, 0, 0, 2, 23, 0, 0, 0, 0, 255, 0, 1, 24, 0, 0, 135, 6, 127, 0, 20, 19, 21, 18, 16, 22, 23, 24, 121, 6, 205, 0, 1, 23, 0, 0, 106, 18, 6, 4, 1, 21, 0, 0, 1, 19, 0, 0, 1, 20, 0, 0, 135, 22, 128, 0, 18, 21, 19, 20, 135, 24, 129, 0, 6, 23, 22, 0, 135, 24, 130, 0, 6, 0, 0, 0, 121, 24, 4, 0, 135, 24, 131, 0, 6, 0, 0, 0, 119, 0, 190, 0, 2, 24, 0, 0, 0, 184, 11, 0, 135, 7, 132, 0, 24, 0, 0, 0, 1, 2, 0, 0, 2, 1, 0, 0, 232, 234, 2, 0, 2, 24, 0, 0, 0, 184, 11, 0, 56, 24, 24, 2, 204, 84, 0, 0, 25, 5, 1, 1, 79, 3, 1, 0, 1, 24, 128, 0, 19, 24, 3, 24, 120, 24, 8, 0, 27, 1, 3, 3, 3, 22, 7, 2, 135, 24, 133, 0, 22, 5, 1, 0, 3, 2, 1, 2, 3, 1, 5, 1, 119, 0, 241, 255, 27, 4, 3, 3, 0, 0, 2, 0, 1, 24, 128, 0, 4, 3, 3, 24, 3, 14, 7, 0, 78, 24, 5, 0, 83, 14, 24, 0, 102, 22, 5, 1, 107, 14, 1, 22, 102, 24, 5, 2, 107, 14, 2, 24, 26, 3, 3, 1, 120, 3, 2, 0, 119, 0, 3, 0, 25, 0, 0, 3, 119, 0, 245, 255, 1, 24, 128, 1, 4, 24, 2, 24, 3, 2, 24, 4, 25, 1, 1, 4, 119, 0, 220, 255, 25, 4, 6, 20, 25, 3, 6, 16, 1, 5, 0, 0, 1, 24, 144, 1, 52, 24, 5, 24, 80, 85, 0, 0, 1, 24, 128, 7, 5, 24, 5, 24, 3, 1, 7, 24, 82, 24, 4, 0, 82, 23, 3, 0, 5, 22, 23, 5, 3, 2, 24, 22, 1, 0, 0, 0, 1, 22, 128, 2, 52, 22, 0, 22, 72, 85, 0, 0, 27, 14, 0, 3, 25, 22, 14, 1, 91, 22, 1, 22, 41, 22, 22, 8, 91, 24, 1, 14, 20, 22, 22, 24, 25, 24, 14, 2, 91, 24, 1, 24, 41, 24, 24, 16, 20, 22, 22, 24, 85, 2, 22, 0, 25, 2, 2, 4, 25, 0, 0, 1, 119, 0, 240, 255, 25, 5, 5, 1, 119, 0, 227, 255, 135, 22, 134, 0, 6, 0, 0, 0, 135, 2, 135, 0, 1, 3, 0, 0, 1, 22, 88, 2, 57, 22, 22, 3, 188, 86, 0, 0, 135, 22, 136, 0, 11, 0, 0, 0, 120, 22, 2, 0, 119, 0, 8, 0, 82, 22, 11, 0, 1, 24, 0, 1, 45, 22, 22, 24, 148, 85, 0, 0, 1, 12, 96, 0, 119, 0, 75, 0, 119, 0, 246, 255, 1, 24, 1, 0, 135, 22, 137, 0, 24, 0, 0, 0, 120, 3, 29, 0, 2, 22, 0, 0, 136, 59, 52, 0, 82, 14, 22, 0, 1, 24, 0, 0, 106, 20, 14, 4, 1, 19, 0, 0, 1, 21, 0, 0, 1, 18, 0, 0, 135, 23, 128, 0, 20, 19, 21, 18, 135, 22, 129, 0, 14, 24, 23, 0, 1, 23, 255, 255, 135, 22, 138, 0, 6, 17, 23, 0, 1, 23, 0, 0, 2, 24, 0, 0, 136, 59, 52, 0, 82, 24, 24, 0, 1, 18, 0, 0, 135, 22, 139, 0, 6, 23, 24, 18, 2, 18, 0, 0, 136, 59, 52, 0, 82, 18, 18, 0, 135, 22, 140, 0, 18, 0, 0, 0, 119, 0, 39, 0, 2, 22, 0, 0, 136, 59, 52, 0, 82, 1, 22, 0, 1, 22, 243, 1, 48, 22, 22, 3, 164, 86, 0, 0, 1, 18, 0, 0, 106, 23, 1, 4, 1, 21, 0, 0, 1, 19, 0, 0, 1, 20, 0, 0, 135, 24, 128, 0, 23, 21, 19, 20, 135, 22, 129, 0, 1, 18, 24, 0, 1, 24, 87, 2, 4, 24, 24, 3, 5, 24, 24, 16, 29, 24, 24, 99, 19, 24, 24, 16, 135, 22, 138, 0, 6, 17, 24, 0, 1, 24, 0, 0, 2, 18, 0, 0, 136, 59, 52, 0, 82, 18, 18, 0, 1, 20, 0, 0, 135, 22, 139, 0, 6, 24, 18, 20, 2, 20, 0, 0, 136, 59, 52, 0, 82, 20, 20, 0, 135, 22, 140, 0, 20, 0, 0, 0, 119, 0, 4, 0, 135, 22, 140, 0, 1, 0, 0, 0, 119, 0, 1, 0, 135, 22, 135, 0, 4, 3, 22, 2, 119, 0, 170, 255, 2, 22, 0, 0, 136, 59, 52, 0, 82, 14, 22, 0, 1, 20, 0, 0, 106, 24, 14, 4, 1, 19, 0, 0, 1, 21, 0, 0, 1, 23, 0, 0, 135, 18, 128, 0, 24, 19, 21, 23, 135, 22, 129, 0, 14, 20, 18, 0, 2, 18, 0, 0, 136, 59, 52, 0, 82, 18, 18, 0, 135, 22, 140, 0, 18, 0, 0, 0, 135, 22, 131, 0, 6, 0, 0, 0, 135, 22, 141, 0, 7, 0, 0, 0, 1, 18, 125, 3, 1, 20, 8, 0, 1, 23, 1, 0, 2, 21, 0, 0, 56, 91, 4, 0, 2, 19, 0, 0, 65, 91, 4, 0, 135, 22, 142, 0, 18, 20, 23, 21, 19, 0, 0, 0, 1, 19, 126, 3, 1, 21, 9, 0, 1, 23, 1, 0, 2, 20, 0, 0, 74, 91, 4, 0, 2, 18, 0, 0, 83, 91, 4, 0, 135, 22, 142, 0, 19, 21, 23, 20, 18, 0, 0, 0, 1, 18, 127, 3, 1, 20, 12, 0, 1, 23, 2, 0, 2, 21, 0, 0, 93, 91, 4, 0, 2, 19, 0, 0, 101, 91, 4, 0, 135, 22, 142, 0, 18, 20, 23, 21, 19, 0, 0, 0, 1, 19, 128, 3, 1, 21, 17, 0, 1, 23, 3, 0, 2, 20, 0, 0, 112, 91, 4, 0, 2, 18, 0, 0, 120, 91, 4, 0, 135, 22, 142, 0, 19, 21, 23, 20, 18, 0, 0, 0, 1, 18, 129, 3, 1, 20, 16, 0, 1, 23, 2, 0, 2, 21, 0, 0, 220, 89, 4, 0, 2, 19, 0, 0, 128, 91, 4, 0, 135, 22, 142, 0, 18, 20, 23, 21, 19, 0, 0, 0, 135, 22, 143, 0, 135, 22, 99, 0, 10, 0, 0, 0, 135, 22, 99, 0, 9, 0, 0, 0, 135, 22, 99, 0, 8, 0, 0, 0, 137, 13, 0, 0, 139, 0, 0, 0, 140, 1, 40, 0, 0, 0, 0, 0, 2, 32, 0, 0, 255, 0, 0, 0, 2, 33, 0, 0, 112, 174, 4, 0, 2, 34, 0, 0, 0, 4, 0, 0, 2, 35, 0, 0, 164, 214, 3, 0, 1, 29, 0, 0, 136, 36, 0, 0, 0, 31, 36, 0, 136, 36, 0, 0, 2, 37, 0, 0, 112, 7, 1, 0, 3, 36, 36, 37, 137, 36, 0, 0, 2, 36, 0, 0, 88, 5, 1, 0, 3, 13, 31, 36, 2, 36, 0, 0, 80, 5, 1, 0, 3, 22, 31, 36, 2, 36, 0, 0, 72, 5, 1, 0, 3, 21, 31, 36, 2, 36, 0, 0, 64, 5, 1, 0, 3, 20, 31, 36, 2, 36, 0, 0, 56, 5, 1, 0, 3, 19, 31, 36, 2, 36, 0, 0, 48, 5, 1, 0, 3, 16, 31, 36, 2, 36, 0, 0, 40, 5, 1, 0, 3, 15, 31, 36, 2, 36, 0, 0, 32, 5, 1, 0, 3, 14, 31, 36, 2, 36, 0, 0, 24, 5, 1, 0, 3, 11, 31, 36, 2, 36, 0, 0, 108, 7, 1, 0, 3, 17, 31, 36, 2, 36, 0, 0, 96, 7, 1, 0, 3, 30, 31, 36, 2, 36, 0, 0, 92, 5, 1, 0, 3, 18, 31, 36, 1, 36, 16, 5, 3, 28, 31, 36, 1, 36, 16, 1, 3, 24, 31, 36, 0, 23, 31, 0, 135, 36, 144, 0, 0, 0, 0, 0, 2, 37, 0, 0, 0, 63, 52, 0, 82, 37, 37, 0, 135, 36, 145, 0, 37, 0, 0, 0, 121, 36, 11, 0, 2, 38, 0, 0, 41, 62, 4, 0, 135, 37, 146, 0, 38, 0, 0, 0, 2, 38, 0, 0, 16, 5, 1, 0, 3, 38, 31, 38, 135, 36, 147, 0, 0, 37, 38, 0, 119, 0, 220, 3, 1, 36, 0, 0, 85, 17, 36, 0, 1, 36, 0, 0, 85, 30, 36, 0, 1, 38, 0, 0, 109, 30, 4, 38, 1, 36, 0, 0, 109, 30, 8, 36, 2, 38, 0, 0, 164, 46, 203, 1, 2, 39, 0, 0, 164, 46, 203, 1, 135, 37, 96, 0, 39, 0, 0, 0, 135, 36, 97, 0, 30, 38, 37, 0, 25, 10, 0, 16, 82, 37, 10, 0, 135, 36, 148, 0, 37, 0, 0, 0, 120, 36, 4, 0, 135, 36, 149, 0, 0, 0, 0, 0, 119, 0, 194, 3, 25, 1, 0, 4, 25, 12, 1, 11, 25, 9, 0, 8, 1, 2, 65, 0, 1, 3, 0, 0, 1, 4, 0, 0, 1, 5, 0, 0, 1, 6, 0, 0, 1, 7, 0, 0, 0, 26, 4, 0, 0, 25, 5, 0, 0, 27, 6, 0, 0, 6, 3, 0, 82, 37, 10, 0, 135, 36, 148, 0, 37, 0, 0, 0, 50, 36, 36, 6, 224, 89, 0, 0, 1, 29, 53, 0, 119, 0, 240, 0, 25, 3, 6, 1, 82, 37, 10, 0, 135, 36, 150, 0, 37, 3, 1, 0, 120, 36, 2, 0, 119, 0, 243, 255, 2, 36, 0, 0, 100, 62, 4, 0, 135, 4, 96, 0, 36, 0, 0, 0, 78, 8, 12, 0, 41, 37, 8, 24, 42, 37, 37, 24, 34, 37, 37, 0, 121, 37, 4, 0, 82, 37, 9, 0, 0, 36, 37, 0, 119, 0, 3, 0, 19, 37, 8, 32, 0, 36, 37, 0, 45, 36, 4, 36, 92, 90, 0, 0, 1, 37, 0, 0, 1, 38, 255, 255, 2, 39, 0, 0, 100, 62, 4, 0, 135, 36, 114, 0, 1, 37, 38, 39, 4, 0, 0, 0, 120, 36, 2, 0, 119, 0, 174, 0, 135, 4, 96, 0, 35, 0, 0, 0, 78, 8, 12, 0, 41, 39, 8, 24, 42, 39, 39, 24, 34, 39, 39, 0, 121, 39, 4, 0, 82, 39, 9, 0, 0, 36, 39, 0, 119, 0, 3, 0, 19, 39, 8, 32, 0, 36, 39, 0, 45, 36, 4, 36, 176, 90, 0, 0, 1, 39, 0, 0, 1, 38, 255, 255, 135, 36, 114, 0, 1, 39, 38, 35, 4, 0, 0, 0, 120, 36, 2, 0, 119, 0, 153, 0, 2, 36, 0, 0, 167, 214, 3, 0, 135, 4, 96, 0, 36, 0, 0, 0, 78, 8, 12, 0, 41, 38, 8, 24, 42, 38, 38, 24, 34, 38, 38, 0, 121, 38, 4, 0, 82, 38, 9, 0, 0, 36, 38, 0, 119, 0, 3, 0, 19, 38, 8, 32, 0, 36, 38, 0, 45, 36, 4, 36, 24, 91, 0, 0, 1, 38, 0, 0, 1, 39, 255, 255, 2, 37, 0, 0, 167, 214, 3, 0, 135, 36, 114, 0, 1, 38, 39, 37, 4, 0, 0, 0, 121, 36, 4, 0, 1, 29, 25, 0, 119, 0, 2, 0, 1, 29, 25, 0, 32, 36, 29, 25, 121, 36, 26, 0, 1, 29, 0, 0, 2, 36, 0, 0, 170, 214, 3, 0, 135, 4, 96, 0, 36, 0, 0, 0, 78, 8, 12, 0, 41, 37, 8, 24, 42, 37, 37, 24, 34, 37, 37, 0, 121, 37, 4, 0, 82, 37, 9, 0, 0, 36, 37, 0, 119, 0, 3, 0, 19, 37, 8, 32, 0, 36, 37, 0, 53, 36, 4, 36, 32, 92, 0, 0, 1, 37, 0, 0, 1, 39, 255, 255, 2, 38, 0, 0, 170, 214, 3, 0, 135, 36, 114, 0, 1, 37, 39, 38, 4, 0, 0, 0, 120, 36, 39, 0, 25, 6, 6, 2, 82, 38, 10, 0, 135, 36, 150, 0, 38, 6, 1, 0, 120, 36, 3, 0, 1, 29, 39, 0, 119, 0, 127, 0, 1, 8, 0, 0, 78, 3, 12, 0, 41, 36, 3, 24, 42, 36, 36, 24, 34, 5, 36, 0, 121, 5, 3, 0, 82, 3, 9, 0, 119, 0, 3, 0, 19, 36, 3, 32, 0, 3, 36, 0, 57, 36, 3, 8, 20, 92, 0, 0, 121, 5, 3, 0, 82, 3, 1, 0, 119, 0, 2, 0, 0, 3, 1, 0, 90, 38, 3, 8, 135, 36, 88, 0, 38, 0, 0, 0, 19, 36, 36, 32, 0, 4, 36, 0, 121, 5, 3, 0, 82, 3, 1, 0, 119, 0, 2, 0, 0, 3, 1, 0, 95, 3, 8, 4, 25, 8, 8, 1, 119, 0, 230, 255, 135, 36, 151, 0, 30, 1, 0, 0, 119, 0, 106, 255, 2, 36, 0, 0, 196, 202, 3, 0, 135, 4, 146, 0, 36, 0, 0, 0, 78, 36, 12, 0, 34, 36, 36, 0, 121, 36, 3, 0, 82, 5, 1, 0, 119, 0, 2, 0, 0, 5, 1, 0, 85, 11, 5, 0, 135, 36, 147, 0, 0, 4, 11, 0, 78, 36, 12, 0, 34, 36, 36, 0, 121, 36, 3, 0, 82, 4, 1, 0, 119, 0, 2, 0, 0, 4, 1, 0, 1, 36, 0, 0, 135, 8, 152, 0, 0, 4, 17, 18, 36, 0, 0, 0, 120, 8, 3, 0, 1, 29, 50, 0, 119, 0, 70, 0, 41, 36, 6, 2, 3, 6, 33, 36, 82, 4, 6, 0, 121, 4, 5, 0, 135, 36, 153, 0, 4, 0, 0, 0, 135, 36, 154, 0, 4, 0, 0, 0, 1, 36, 36, 2, 135, 4, 155, 0, 36, 0, 0, 0, 78, 36, 12, 0, 34, 36, 36, 0, 121, 36, 3, 0, 82, 5, 1, 0, 119, 0, 2, 0, 0, 5, 1, 0, 82, 38, 17, 0, 1, 39, 0, 0, 135, 36, 156, 0, 4, 8, 5, 38, 39, 0, 0, 0, 85, 6, 4, 0, 32, 6, 27, 0, 82, 5, 18, 0, 125, 26, 6, 5, 26, 0, 0, 0, 125, 25, 6, 25, 5, 0, 0, 0, 125, 27, 6, 8, 27, 0, 0, 0, 125, 7, 6, 7, 8, 0, 0, 0, 119, 0, 45, 255, 25, 3, 6, 2, 82, 39, 10, 0, 135, 36, 150, 0, 39, 3, 1, 0, 120, 36, 3, 0, 1, 29, 22, 0, 119, 0, 29, 0, 78, 36, 12, 0, 34, 36, 36, 0, 121, 36, 3, 0, 82, 2, 1, 0, 119, 0, 2, 0, 0, 2, 1, 0, 78, 36, 2, 0, 135, 2, 88, 0, 36, 0, 0, 0, 19, 36, 2, 32, 41, 36, 36, 24, 42, 36, 36, 24, 1, 39, 65, 0, 1, 38, 4, 0, 138, 36, 39, 38, 128, 93, 0, 0, 120, 93, 0, 0, 132, 93, 0, 0, 136, 93, 0, 0, 1, 29, 21, 0, 119, 0, 8, 0, 119, 0, 3, 0, 119, 0, 2, 0, 119, 0, 1, 0, 0, 4, 26, 0, 0, 5, 25, 0, 0, 6, 27, 0, 119, 0, 7, 255, 32, 36, 29, 21, 121, 36, 4, 0, 135, 36, 149, 0, 0, 0, 0, 0, 119, 0, 186, 2, 32, 36, 29, 22, 121, 36, 4, 0, 135, 36, 149, 0, 0, 0, 0, 0, 119, 0, 181, 2, 32, 36, 29, 39, 121, 36, 4, 0, 135, 36, 149, 0, 0, 0, 0, 0, 119, 0, 176, 2, 32, 36, 29, 50, 121, 36, 13, 0, 2, 36, 0, 0, 244, 202, 3, 0, 135, 2, 146, 0, 36, 0, 0, 0, 78, 36, 12, 0, 34, 36, 36, 0, 121, 36, 2, 0, 82, 1, 1, 0, 85, 14, 1, 0, 135, 36, 147, 0, 0, 2, 14, 0, 119, 0, 162, 2, 32, 36, 29, 53, 121, 36, 160, 2, 2, 36, 0, 0, 80, 70, 118, 1, 1, 39, 0, 0, 85, 36, 39, 0, 135, 39, 157, 0, 19, 39, 2, 32, 0, 2, 39, 0, 2, 39, 0, 0, 96, 174, 4, 0, 26, 36, 2, 65, 41, 36, 36, 2, 94, 1, 39, 36, 120, 1, 9, 0, 2, 39, 0, 0, 145, 202, 3, 0, 135, 29, 146, 0, 39, 0, 0, 0, 85, 15, 2, 0, 135, 39, 147, 0, 0, 29, 15, 0, 119, 0, 139, 2, 1, 36, 0, 0, 1, 38, 0, 0, 1, 37, 1, 0, 135, 39, 158, 0, 1, 36, 38, 37, 18, 0, 0, 0, 78, 39, 18, 0, 32, 39, 39, 80, 121, 39, 15, 2, 102, 39, 18, 1, 32, 39, 39, 67, 121, 39, 10, 2, 102, 39, 18, 2, 32, 39, 39, 106, 121, 39, 5, 2, 102, 39, 18, 3, 32, 39, 39, 114, 121, 39, 0, 2, 2, 39, 0, 0, 4, 63, 52, 0, 82, 39, 39, 0, 33, 39, 39, 3, 121, 39, 8, 0, 2, 38, 0, 0, 75, 203, 3, 0, 135, 37, 146, 0, 38, 0, 0, 0, 135, 39, 147, 0, 0, 37, 16, 0, 119, 0, 251, 1, 2, 39, 0, 0, 164, 46, 203, 1, 135, 1, 96, 0, 39, 0, 0, 0, 25, 8, 30, 11, 78, 29, 8, 0, 25, 9, 30, 4, 41, 37, 29, 24, 42, 37, 37, 24, 34, 37, 37, 0, 121, 37, 4, 0, 82, 37, 9, 0, 0, 39, 37, 0, 119, 0, 3, 0, 19, 37, 29, 32, 0, 39, 37, 0, 45, 39, 1, 39, 96, 95, 0, 0, 1, 37, 0, 0, 1, 38, 255, 255, 2, 36, 0, 0, 164, 46, 203, 1, 135, 39, 114, 0, 30, 37, 38, 36, 1, 0, 0, 0, 120, 39, 4, 0, 1, 1, 255, 255, 1, 29, 94, 0, 119, 0, 4, 0, 1, 29, 63, 0, 119, 0, 2, 0, 1, 29, 63, 0, 32, 39, 29, 63, 121, 39, 206, 0, 1, 36, 0, 2, 1, 38, 0, 0, 135, 39, 159, 0, 27, 36, 38, 0, 1, 38, 1, 0, 1, 36, 0, 2, 4, 36, 26, 36, 135, 39, 160, 0, 28, 38, 36, 27, 1, 39, 0, 0, 83, 24, 39, 0, 103, 2, 28, 6, 2, 39, 0, 0, 143, 1, 4, 0, 135, 1, 96, 0, 39, 0, 0, 0, 78, 29, 8, 0, 41, 36, 29, 24, 42, 36, 36, 24, 34, 36, 36, 0, 121, 36, 4, 0, 82, 36, 9, 0, 0, 39, 36, 0, 119, 0, 3, 0, 19, 36, 29, 32, 0, 39, 36, 0, 45, 39, 1, 39, 16, 97, 0, 0, 1, 36, 0, 0, 1, 38, 255, 255, 2, 37, 0, 0, 143, 1, 4, 0, 135, 39, 114, 0, 30, 36, 38, 37, 1, 0, 0, 0, 120, 39, 68, 0, 1, 1, 6, 0, 120, 2, 3, 0, 1, 29, 70, 0, 119, 0, 26, 0, 25, 37, 1, 1, 3, 37, 28, 37, 135, 39, 115, 0, 23, 37, 2, 0, 1, 37, 0, 0, 95, 23, 2, 37, 135, 37, 161, 0, 23, 0, 0, 0, 135, 37, 69, 0, 24, 0, 0, 0, 3, 29, 24, 37, 1, 37, 32, 0, 83, 29, 37, 0, 1, 39, 0, 0, 107, 29, 1, 39, 135, 39, 162, 0, 24, 23, 0, 0, 25, 39, 1, 4, 3, 1, 39, 2, 48, 39, 34, 1, 104, 96, 0, 0, 1, 29, 71, 0, 119, 0, 3, 0, 91, 2, 28, 1, 119, 0, 229, 255, 32, 39, 29, 70, 121, 39, 12, 0, 1, 39, 6, 0, 48, 39, 39, 1, 140, 96, 0, 0, 1, 29, 71, 0, 119, 0, 7, 0, 2, 38, 0, 0, 213, 203, 3, 0, 135, 37, 146, 0, 38, 0, 0, 0, 135, 39, 147, 0, 0, 37, 20, 0, 32, 39, 29, 71, 121, 39, 8, 0, 2, 39, 0, 0, 147, 203, 3, 0, 135, 28, 146, 0, 39, 0, 0, 0, 85, 19, 24, 0, 135, 39, 147, 0, 0, 28, 19, 0, 1, 3, 0, 0, 1, 39, 20, 0, 57, 39, 39, 3, 20, 97, 0, 0, 41, 39, 3, 2, 3, 2, 33, 39, 82, 1, 2, 0, 121, 1, 7, 0, 135, 39, 153, 0, 1, 0, 0, 0, 135, 39, 154, 0, 1, 0, 0, 0, 1, 39, 0, 0, 85, 2, 39, 0, 25, 3, 3, 1, 119, 0, 242, 255, 1, 29, 65, 0, 119, 0, 2, 0, 1, 29, 65, 0, 32, 39, 29, 65, 121, 39, 98, 0, 1, 1, 6, 0, 120, 2, 3, 0, 1, 29, 84, 0, 119, 0, 48, 0, 25, 1, 1, 1, 3, 37, 28, 1, 135, 39, 115, 0, 23, 37, 2, 0, 1, 37, 0, 0, 95, 23, 2, 37, 135, 37, 161, 0, 23, 0, 0, 0, 135, 37, 69, 0, 24, 0, 0, 0, 3, 29, 24, 37, 1, 37, 32, 0, 83, 29, 37, 0, 1, 39, 0, 0, 107, 29, 1, 39, 135, 39, 162, 0, 24, 23, 0, 0, 3, 1, 1, 2, 135, 2, 96, 0, 23, 0, 0, 0, 78, 29, 8, 0, 41, 37, 29, 24, 42, 37, 37, 24, 34, 37, 37, 0, 121, 37, 4, 0, 82, 37, 9, 0, 0, 39, 37, 0, 119, 0, 3, 0, 19, 37, 29, 32, 0, 39, 37, 0, 45, 39, 2, 39, 204, 97, 0, 0, 1, 37, 0, 0, 1, 38, 255, 255, 135, 39, 114, 0, 30, 37, 38, 23, 2, 0, 0, 0, 120, 39, 3, 0, 1, 29, 83, 0, 119, 0, 8, 0, 25, 1, 1, 3, 48, 39, 34, 1, 224, 97, 0, 0, 1, 29, 85, 0, 119, 0, 3, 0, 91, 2, 28, 1, 119, 0, 207, 255, 32, 39, 29, 83, 121, 39, 7, 0, 34, 39, 1, 1, 121, 39, 3, 0, 1, 29, 84, 0, 119, 0, 3, 0, 1, 29, 94, 0, 119, 0, 39, 0, 32, 39, 29, 84, 121, 39, 12, 0, 1, 39, 6, 0, 48, 39, 39, 1, 36, 98, 0, 0, 1, 29, 85, 0, 119, 0, 7, 0, 2, 37, 0, 0, 213, 203, 3, 0, 135, 38, 146, 0, 37, 0, 0, 0, 135, 39, 147, 0, 0, 38, 22, 0, 32, 39, 29, 85, 121, 39, 8, 0, 2, 39, 0, 0, 147, 203, 3, 0, 135, 28, 146, 0, 39, 0, 0, 0, 85, 21, 24, 0, 135, 39, 147, 0, 0, 28, 21, 0, 1, 3, 0, 0, 1, 39, 20, 0, 57, 39, 39, 3, 160, 98, 0, 0, 41, 39, 3, 2, 3, 2, 33, 39, 82, 1, 2, 0, 121, 1, 7, 0, 135, 39, 153, 0, 1, 0, 0, 0, 135, 39, 154, 0, 1, 0, 0, 0, 1, 39, 0, 0, 85, 2, 39, 0, 25, 3, 3, 1, 119, 0, 242, 255, 32, 39, 29, 94, 121, 39, 10, 1, 135, 39, 163, 0, 0, 0, 0, 0, 135, 39, 164, 0, 121, 27, 6, 1, 2, 39, 0, 0, 173, 214, 3, 0, 1, 38, 1, 0, 135, 2, 152, 0, 0, 39, 24, 23, 38, 0, 0, 0, 121, 2, 31, 0, 1, 39, 0, 48, 1, 37, 0, 0, 135, 38, 159, 0, 2, 39, 37, 0, 1, 37, 1, 0, 2, 39, 0, 0, 0, 176, 0, 0, 135, 38, 160, 0, 28, 37, 39, 2, 2, 39, 0, 0, 0, 176, 0, 0, 45, 38, 38, 39, 68, 99, 0, 0, 1, 3, 0, 0, 2, 38, 0, 0, 0, 176, 0, 0, 52, 38, 3, 38, 68, 99, 0, 0, 2, 38, 0, 0, 200, 40, 203, 1, 82, 38, 38, 0, 2, 39, 0, 0, 0, 48, 15, 0, 3, 39, 3, 39, 90, 37, 28, 3, 95, 38, 39, 37, 25, 3, 3, 1, 119, 0, 243, 255, 135, 37, 165, 0, 2, 0, 0, 0, 120, 7, 6, 0, 1, 37, 207, 1, 3, 3, 28, 37, 1, 37, 206, 1, 3, 2, 28, 37, 119, 0, 39, 0, 1, 39, 0, 0, 1, 38, 0, 0, 135, 37, 159, 0, 7, 39, 38, 0, 1, 38, 1, 0, 1, 39, 0, 2, 135, 37, 160, 0, 28, 38, 39, 7, 1, 37, 206, 1, 3, 2, 28, 37, 1, 37, 207, 1, 3, 3, 28, 37, 79, 37, 3, 0, 41, 37, 37, 8, 79, 39, 2, 0, 20, 37, 37, 39, 41, 37, 37, 4, 0, 6, 37, 0, 1, 39, 0, 2, 1, 38, 0, 0, 135, 37, 159, 0, 7, 39, 38, 0, 1, 37, 0, 2, 4, 5, 25, 37, 1, 38, 1, 0, 135, 37, 160, 0, 28, 38, 5, 7, 1, 4, 0, 0, 52, 37, 4, 5, 252, 99, 0, 0, 2, 37, 0, 0, 200, 40, 203, 1, 82, 37, 37, 0, 3, 38, 4, 6, 90, 39, 28, 4, 95, 37, 38, 39, 25, 4, 4, 1, 119, 0, 247, 255, 1, 38, 0, 0, 1, 37, 0, 0, 135, 39, 159, 0, 27, 38, 37, 0, 1, 37, 1, 0, 1, 38, 0, 2, 135, 39, 160, 0, 28, 37, 38, 27, 79, 39, 3, 0, 41, 39, 39, 8, 79, 38, 2, 0, 20, 39, 39, 38, 0, 4, 39, 0, 1, 38, 0, 2, 1, 37, 0, 0, 135, 39, 159, 0, 27, 38, 37, 0, 1, 39, 0, 2, 4, 3, 26, 39, 1, 37, 1, 0, 135, 39, 160, 0, 28, 37, 3, 27, 41, 39, 4, 4, 0, 6, 39, 0, 1, 2, 0, 0, 52, 39, 2, 3, 136, 100, 0, 0, 2, 39, 0, 0, 200, 40, 203, 1, 82, 39, 39, 0, 3, 37, 2, 6, 90, 38, 28, 2, 95, 39, 37, 38, 25, 2, 2, 1, 119, 0, 247, 255, 2, 38, 0, 0, 255, 255, 0, 0, 19, 38, 4, 38, 0, 5, 38, 0, 1, 4, 0, 0, 1, 38, 20, 0, 57, 38, 38, 4, 216, 100, 0, 0, 41, 38, 4, 2, 3, 3, 33, 38, 82, 2, 3, 0, 121, 2, 7, 0, 135, 38, 153, 0, 2, 0, 0, 0, 135, 38, 154, 0, 2, 0, 0, 0, 1, 38, 0, 0, 85, 3, 38, 0, 25, 4, 4, 1, 119, 0, 242, 255, 2, 38, 0, 0, 164, 46, 203, 1, 135, 2, 96, 0, 38, 0, 0, 0, 78, 28, 8, 0, 41, 37, 28, 24, 42, 37, 37, 24, 34, 37, 37, 0, 121, 37, 4, 0, 82, 37, 9, 0, 0, 38, 37, 0, 119, 0, 3, 0, 19, 37, 28, 32, 0, 38, 37, 0, 45, 38, 2, 38, 12, 102, 0, 0, 1, 37, 0, 0, 1, 39, 255, 255, 2, 36, 0, 0, 164, 46, 203, 1, 135, 38, 114, 0, 30, 37, 39, 36, 2, 0, 0, 0, 120, 38, 52, 0, 1, 38, 96, 0, 135, 28, 44, 0, 38, 0, 0, 0, 2, 38, 0, 0, 142, 69, 118, 1, 84, 38, 5, 0, 2, 38, 0, 0, 164, 69, 118, 1, 85, 38, 6, 0, 2, 38, 0, 0, 136, 69, 118, 1, 84, 38, 5, 0, 2, 38, 0, 0, 152, 69, 118, 1, 85, 38, 6, 0, 2, 38, 0, 0, 140, 69, 118, 1, 1, 36, 0, 128, 84, 38, 36, 0, 2, 36, 0, 0, 160, 69, 118, 1, 2, 38, 0, 0, 0, 0, 8, 0, 85, 36, 38, 0, 2, 38, 0, 0, 216, 68, 118, 1, 2, 36, 0, 0, 254, 255, 0, 0, 85, 38, 36, 0, 1, 38, 3, 0, 134, 36, 0, 0, 180, 68, 1, 0, 5, 38, 0, 0, 1, 36, 96, 0, 135, 1, 44, 0, 36, 0, 0, 0, 52, 36, 28, 1, 16, 102, 0, 0, 43, 36, 1, 16, 0, 28, 36, 0, 2, 36, 0, 0, 138, 69, 118, 1, 84, 36, 28, 0, 2, 36, 0, 0, 156, 69, 118, 1, 41, 38, 28, 4, 85, 36, 38, 0, 2, 38, 0, 0, 232, 68, 118, 1, 84, 38, 1, 0, 119, 0, 4, 0, 1, 29, 118, 0, 119, 0, 2, 0, 1, 29, 118, 0, 32, 38, 29, 118, 121, 38, 46, 0, 1, 38, 0, 0, 47, 38, 38, 1, 172, 102, 0, 0, 2, 38, 0, 0, 136, 72, 118, 1, 135, 28, 0, 0, 38, 0, 0, 0, 2, 38, 0, 0, 142, 69, 118, 1, 84, 38, 28, 0, 2, 38, 0, 0, 164, 69, 118, 1, 2, 36, 0, 0, 255, 255, 0, 0, 19, 36, 28, 36, 41, 36, 36, 4, 85, 38, 36, 0, 2, 36, 0, 0, 136, 72, 118, 1, 135, 28, 0, 0, 36, 0, 0, 0, 2, 36, 0, 0, 136, 69, 118, 1, 84, 36, 28, 0, 2, 36, 0, 0, 152, 69, 118, 1, 2, 38, 0, 0, 255, 255, 0, 0, 19, 38, 28, 38, 41, 38, 38, 4, 85, 36, 38, 0, 2, 36, 0, 0, 255, 255, 0, 0, 19, 36, 1, 36, 134, 38, 0, 0, 180, 68, 1, 0, 5, 36, 0, 0, 119, 0, 8, 0, 1, 29, 122, 0, 119, 0, 6, 0, 1, 29, 122, 0, 119, 0, 4, 0, 1, 29, 122, 0, 119, 0, 2, 0, 1, 29, 122, 0, 32, 38, 29, 122, 121, 38, 113, 0, 135, 38, 163, 0, 0, 0, 0, 0, 135, 38, 166, 0, 2, 38, 0, 0, 31, 203, 3, 0, 135, 1, 146, 0, 38, 0, 0, 0, 85, 13, 2, 0, 135, 38, 147, 0, 0, 1, 13, 0, 1, 1, 0, 0, 1, 38, 0, 2, 57, 38, 38, 1, 40, 103, 0, 0, 1, 36, 0, 124, 3, 36, 1, 36, 90, 39, 18, 1, 135, 38, 16, 0, 36, 39, 0, 0, 25, 1, 1, 1, 119, 0, 247, 255, 2, 38, 0, 0, 4, 63, 52, 0, 82, 38, 38, 0, 39, 38, 38, 1, 33, 38, 38, 3, 82, 39, 17, 0, 33, 39, 39, 0, 19, 38, 38, 39, 121, 38, 7, 0, 1, 39, 2, 0, 135, 38, 167, 0, 39, 0, 0, 0, 25, 29, 38, 23, 1, 38, 1, 0, 83, 29, 38, 0, 1, 39, 4, 0, 2, 36, 0, 0, 83, 255, 0, 240, 135, 38, 38, 0, 39, 36, 0, 0, 1, 36, 12, 0, 2, 39, 0, 0, 83, 255, 0, 240, 135, 38, 38, 0, 36, 39, 0, 0, 2, 38, 0, 0, 138, 69, 118, 1, 1, 39, 0, 0, 84, 38, 39, 0, 2, 39, 0, 0, 156, 69, 118, 1, 1, 38, 0, 0, 85, 39, 38, 0, 2, 38, 0, 0, 232, 68, 118, 1, 1, 39, 0, 124, 84, 38, 39, 0, 2, 39, 0, 0, 142, 69, 118, 1, 1, 38, 0, 0, 84, 39, 38, 0, 2, 38, 0, 0, 164, 69, 118, 1, 1, 39, 0, 0, 85, 38, 39, 0, 2, 39, 0, 0, 136, 69, 118, 1, 1, 38, 0, 0, 84, 39, 38, 0, 2, 38, 0, 0, 152, 69, 118, 1, 1, 39, 0, 0, 85, 38, 39, 0, 2, 39, 0, 0, 140, 69, 118, 1, 1, 38, 0, 112, 84, 39, 38, 0, 2, 38, 0, 0, 160, 69, 118, 1, 2, 39, 0, 0, 0, 0, 7, 0, 85, 38, 39, 0, 2, 39, 0, 0, 216, 68, 118, 1, 1, 38, 0, 1, 85, 39, 38, 0, 2, 38, 0, 0, 224, 68, 118, 1, 1, 39, 0, 0, 85, 38, 39, 0, 2, 39, 0, 0, 204, 68, 118, 1, 1, 38, 1, 0, 85, 39, 38, 0, 2, 38, 0, 0, 220, 68, 118, 1, 1, 39, 0, 0, 85, 38, 39, 0, 2, 39, 0, 0, 200, 68, 118, 1, 1, 38, 0, 0, 85, 39, 38, 0, 2, 38, 0, 0, 208, 68, 118, 1, 1, 39, 0, 0, 85, 38, 39, 0, 2, 39, 0, 0, 212, 68, 118, 1, 1, 38, 0, 124, 85, 39, 38, 0, 119, 0, 1, 0, 135, 38, 99, 0, 30, 0, 0, 0, 137, 31, 0, 0, 139, 0, 0, 0, 140, 3, 27, 0, 0, 0, 0, 0, 2, 20, 0, 0, 0, 211, 6, 0, 2, 21, 0, 0, 50, 202, 114, 0, 2, 22, 0, 0, 0, 4, 0, 0, 1, 16, 0, 0, 136, 23, 0, 0, 0, 19, 23, 0, 136, 23, 0, 0, 1, 24, 48, 4, 3, 23, 23, 24, 137, 23, 0, 0, 1, 23, 24, 4, 3, 15, 19, 23, 1, 23, 16, 4, 3, 12, 19, 23, 1, 23, 8, 4, 3, 11, 19, 23, 3, 0, 19, 22, 1, 23, 0, 2, 3, 9, 19, 23, 0, 5, 19, 0, 1, 23, 36, 4, 3, 6, 19, 23, 1, 23, 35, 4, 3, 8, 19, 23, 1, 23, 30, 4, 3, 13, 19, 23, 1, 23, 34, 4, 3, 10, 19, 23, 1, 23, 28, 4, 3, 14, 19, 23, 1, 23, 33, 4, 3, 18, 19, 23, 1, 23, 32, 4, 3, 17, 19, 23, 135, 23, 95, 0, 9, 1, 0, 0, 2, 24, 0, 0, 112, 50, 4, 0, 135, 23, 106, 0, 9, 24, 0, 0, 120, 23, 3, 0, 1, 3, 0, 0, 119, 0, 61, 23, 2, 23, 0, 0, 200, 72, 118, 1, 81, 23, 23, 0, 45, 23, 23, 2, 128, 105, 0, 0, 1, 3, 0, 0, 119, 0, 54, 23, 2, 24, 0, 0, 116, 106, 4, 0, 135, 23, 106, 0, 9, 24, 0, 0, 120, 23, 146, 18, 1, 23, 91, 3, 47, 23, 2, 23, 24, 118, 0, 0, 1, 24, 113, 0, 1, 23, 234, 2, 138, 2, 24, 23, 92, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 100, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 132, 117, 0, 0, 140, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 144, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 152, 117, 0, 0, 196, 117, 0, 0, 204, 117, 0, 0, 208, 117, 0, 0, 212, 117, 0, 0, 216, 117, 0, 0, 84, 117, 0, 0, 224, 117, 0, 0, 228, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 232, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 236, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 84, 117, 0, 0, 240, 117, 0, 0, 248, 117, 0, 0, 252, 117, 0, 0, 0, 118, 0, 0, 4, 118, 0, 0, 8, 118, 0, 0, 84, 117, 0, 0, 12, 118, 0, 0, 84, 117, 0, 0, 16, 118, 0, 0, 20, 118, 0, 0, 1, 16, 15, 0, 119, 0, 73, 15, 1, 16, 10, 0, 119, 0, 71, 15, 0, 7, 9, 0, 2, 23, 0, 0, 69, 71, 65, 46, 85, 7, 23, 0, 2, 24, 0, 0, 67, 80, 73, 0, 109, 7, 4, 24, 119, 0, 150, 15, 1, 16, 14, 0, 119, 0, 61, 15, 119, 0, 254, 255, 1, 16, 9, 0, 119, 0, 58, 15, 0, 0, 9, 0, 2, 1, 0, 0, 249, 163, 3, 0, 25, 4, 0, 9, 78, 24, 1, 0, 83, 0, 24, 0, 25, 0, 0, 1, 25, 1, 1, 1, 54, 24, 0, 4, 168, 117, 0, 0, 119, 0, 134, 15, 1, 16, 7, 0, 119, 0, 45, 15, 119, 0, 254, 255, 119, 0, 242, 255, 119, 0, 241, 255, 1, 16, 6, 0, 119, 0, 40, 15, 119, 0, 238, 255, 119, 0, 237, 255, 119, 0, 231, 255, 119, 0, 246, 255, 1, 16, 8, 0, 119, 0, 34, 15, 119, 0, 254, 255, 119, 0, 218, 255, 119, 0, 228, 255, 119, 0, 216, 255, 119, 0, 215, 255, 119, 0, 238, 255, 119, 0, 213, 255, 119, 0, 212, 255, 1, 24, 93, 4, 47, 24, 2, 24, 176, 122, 0, 0, 1, 24, 91, 3, 1, 23, 2, 1, 138, 2, 24, 23, 64, 122, 0, 0, 72, 122, 0, 0, 76, 122, 0, 0, 56, 122, 0, 0, 80, 122, 0, 0, 56, 122, 0, 0, 84, 122, 0, 0, 88, 122, 0, 0, 96, 122, 0, 0, 56, 122, 0, 0, 104, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 112, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 116, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0], eb + 20480);
  HEAPU8.set([56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 124, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 56, 122, 0, 0, 128, 122, 0, 0, 1, 16, 15, 0, 119, 0, 16, 14, 1, 16, 6, 0, 119, 0, 14, 14, 119, 0, 15, 0, 119, 0, 14, 0, 119, 0, 13, 0, 119, 0, 12, 0, 1, 16, 7, 0, 119, 0, 8, 14, 1, 16, 14, 0, 119, 0, 6, 14, 1, 16, 9, 0, 119, 0, 4, 14, 119, 0, 250, 255, 1, 16, 10, 0, 119, 0, 1, 14, 119, 0, 249, 255, 119, 0, 240, 255, 0, 0, 9, 0, 2, 1, 0, 0, 2, 164, 3, 0, 25, 4, 0, 9, 78, 24, 1, 0, 83, 0, 24, 0, 25, 0, 0, 1, 25, 1, 1, 1, 54, 24, 0, 4, 148, 122, 0, 0, 119, 0, 75, 14, 2, 24, 0, 0, 98, 231, 0, 0, 47, 24, 2, 24, 20, 130, 0, 0, 2, 24, 0, 0, 181, 225, 0, 0, 47, 24, 2, 24, 52, 123, 0, 0, 1, 24, 93, 4, 1, 23, 15, 0, 138, 2, 24, 23, 32, 123, 0, 0, 24, 123, 0, 0, 24, 123, 0, 0, 24, 123, 0, 0, 24, 123, 0, 0, 24, 123, 0, 0, 24, 123, 0, 0, 24, 123, 0, 0, 40, 123, 0, 0, 24, 123, 0, 0, 24, 123, 0, 0, 24, 123, 0, 0, 24, 123, 0, 0, 24, 123, 0, 0, 48, 123, 0, 0, 1, 16, 15, 0, 119, 0, 216, 13, 1, 16, 6, 0, 119, 0, 214, 13, 1, 16, 8, 0, 119, 0, 212, 13, 119, 0, 254, 255, 2, 24, 0, 0, 181, 225, 0, 0, 1, 23, 174, 1, 138, 2, 24, 23, 4, 130, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 12, 130, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 252, 129, 0, 0, 16, 130, 0, 0, 1, 16, 15, 0, 119, 0, 31, 12, 1, 16, 14, 0, 119, 0, 29, 12, 119, 0, 17, 12, 119, 0, 16, 12, 2, 24, 0, 0, 98, 231, 0, 0, 1, 23, 1, 12, 138, 2, 24, 23, 48, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 52, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 60, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 64, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0], eb + 30720);
  HEAPU8.set([40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 68, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 40, 178, 0, 0, 76, 178, 0, 0, 1, 16, 15, 0, 119, 0, 20, 0, 119, 0, 8, 0, 1, 16, 10, 0, 119, 0, 17, 0, 119, 0, 5, 0, 119, 0, 253, 255, 1, 16, 8, 0, 119, 0, 13, 0, 119, 0, 1, 0, 0, 0, 9, 0, 2, 1, 0, 0, 240, 163, 3, 0, 25, 4, 0, 9, 78, 24, 1, 0, 83, 0, 24, 0, 25, 0, 0, 1, 25, 1, 1, 1, 54, 24, 0, 4, 96, 178, 0, 0, 119, 0, 88, 0, 32, 24, 16, 6, 121, 24, 12, 0, 0, 0, 9, 0, 2, 1, 0, 0, 195, 163, 3, 0, 25, 4, 0, 9, 78, 24, 1, 0, 83, 0, 24, 0, 25, 0, 0, 1, 25, 1, 1, 1, 54, 24, 0, 4, 148, 178, 0, 0, 119, 0, 75, 0, 32, 24, 16, 7, 121, 24, 12, 0, 0, 0, 9, 0, 2, 1, 0, 0, 204, 163, 3, 0, 25, 4, 0, 9, 78, 24, 1, 0, 83, 0, 24, 0, 25, 0, 0, 1, 25, 1, 1, 1, 54, 24, 0, 4, 200, 178, 0, 0, 119, 0, 62, 0, 32, 24, 16, 8, 121, 24, 12, 0, 0, 0, 9, 0, 2, 1, 0, 0, 213, 163, 3, 0, 25, 4, 0, 9, 78, 24, 1, 0, 83, 0, 24, 0, 25, 0, 0, 1, 25, 1, 1, 1, 54, 24, 0, 4, 252, 178, 0, 0, 119, 0, 49, 0, 32, 24, 16, 9, 121, 24, 12, 0, 0, 0, 9, 0, 2, 1, 0, 0, 222, 163, 3, 0, 25, 4, 0, 9, 78, 24, 1, 0, 83, 0, 24, 0, 25, 0, 0, 1, 25, 1, 1, 1, 54, 24, 0, 4, 48, 179, 0, 0, 119, 0, 36, 0, 32, 24, 16, 10, 121, 24, 12, 0, 0, 0, 9, 0, 2, 1, 0, 0, 231, 163, 3, 0, 25, 4, 0, 9, 78, 24, 1, 0, 83, 0, 24, 0, 25, 0, 0, 1, 25, 1, 1, 1, 54, 24, 0, 4, 100, 179, 0, 0, 119, 0, 23, 0, 32, 24, 16, 14, 121, 24, 12, 0, 0, 0, 9, 0, 2, 1, 0, 0, 11, 164, 3, 0, 25, 4, 0, 10, 78, 24, 1, 0, 83, 0, 24, 0, 25, 0, 0, 1, 25, 1, 1, 1, 54, 24, 0, 4, 152, 179, 0, 0, 119, 0, 10, 0, 32, 24, 16, 15, 121, 24, 8, 0, 85, 0, 2, 0, 2, 23, 0, 0, 21, 164, 3, 0, 135, 24, 45, 0, 23, 0, 0, 0, 1, 3, 4, 0, 119, 0, 160, 4, 135, 23, 69, 0, 9, 0, 0, 0, 25, 23, 23, 1, 135, 24, 133, 0, 5, 9, 23, 0, 135, 0, 168, 0, 5, 0, 0, 0, 120, 0, 20, 2, 135, 0, 69, 0, 5, 0, 0, 0, 121, 0, 34, 0, 26, 24, 0, 1, 3, 1, 5, 24, 79, 23, 1, 0, 135, 24, 88, 0, 23, 0, 0, 0, 41, 24, 24, 24, 0, 0, 24, 0, 2, 24, 0, 0, 0, 0, 0, 88, 47, 24, 0, 24, 80, 180, 0, 0, 2, 24, 0, 0, 0, 0, 0, 73, 1, 23, 1, 0, 138, 0, 24, 23, 72, 180, 0, 0, 119, 0, 17, 0, 1, 0, 88, 0, 119, 0, 9, 0, 2, 24, 0, 0, 0, 0, 0, 88, 1, 23, 1, 0, 138, 0, 24, 23, 104, 180, 0, 0, 119, 0, 9, 0, 119, 0, 1, 0, 1, 0, 73, 0, 83, 1, 0, 0, 135, 0, 168, 0, 5, 0, 0, 0, 121, 0, 3, 0, 1, 16, 31, 0, 119, 0, 241, 1, 1, 23, 181, 1, 1, 24, 180, 1, 138, 2, 23, 24, 108, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 164, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 220, 187, 0, 0, 20, 188, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 24, 188, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 28, 188, 0, 0, 32, 188, 0, 0, 36, 188, 0, 0, 40, 188, 0, 0, 100, 187, 0, 0, 44, 188, 0, 0, 100, 187, 0, 0, 48, 188, 0, 0, 52, 188, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 56, 188, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 60, 188, 0, 0, 100, 187, 0, 0, 100, 187, 0, 0, 64, 188, 0, 0, 1, 3, 4, 0, 119, 0, 56, 0, 1, 0, 0, 0, 1, 24, 178, 24, 45, 24, 0, 24, 140, 187, 0, 0, 1, 1, 41, 0, 1, 0, 178, 24, 1, 16, 51, 0, 119, 0, 48, 0, 2, 23, 0, 0, 48, 181, 0, 0, 90, 23, 23, 0, 95, 20, 0, 23, 25, 0, 0, 1, 119, 0, 244, 255, 1, 0, 0, 0, 1, 24, 88, 22, 45, 24, 0, 24, 196, 187, 0, 0, 1, 1, 41, 0, 1, 0, 88, 22, 1, 16, 51, 0, 119, 0, 34, 0, 2, 23, 0, 0, 64, 227, 0, 0, 90, 23, 23, 0, 95, 20, 0, 23, 25, 0, 0, 1, 119, 0, 244, 255, 1, 0, 0, 0, 1, 23, 79, 21, 45, 23, 0, 23, 252, 187, 0, 0, 1, 1, 41, 0, 1, 0, 79, 21, 1, 16, 51, 0, 119, 0, 20, 0, 2, 24, 0, 0, 240, 205, 0, 0, 90, 24, 24, 0, 95, 20, 0, 24, 25, 0, 0, 1, 119, 0, 244, 255, 119, 0, 242, 255, 119, 0, 241, 255, 119, 0, 212, 255, 119, 0, 225, 255, 119, 0, 210, 255, 119, 0, 209, 255, 119, 0, 236, 255, 119, 0, 207, 255, 119, 0, 206, 255, 119, 0, 233, 255, 119, 0, 218, 255, 119, 0, 231, 255, 1, 16, 31, 0, 32, 23, 16, 31, 121, 23, 207, 0, 1, 24, 1, 0, 1, 25, 5, 0, 135, 23, 160, 0, 20, 24, 25, 0, 35, 23, 23, 5, 121, 23, 11, 0, 1, 25, 19, 0, 1, 24, 2, 0, 135, 23, 3, 0, 6, 25, 24, 0, 2, 24, 0, 0, 58, 164, 3, 0, 135, 23, 63, 0, 6, 24, 9, 0, 1, 3, 4, 0, 119, 0, 191, 0, 78, 7, 20, 0, 2, 23, 0, 0, 1, 211, 6, 0, 78, 1, 23, 0, 2, 23, 0, 0, 2, 211, 6, 0, 78, 4, 23, 0, 2, 23, 0, 0, 3, 211, 6, 0, 78, 5, 23, 0, 2, 23, 0, 0, 4, 211, 6, 0, 78, 6, 23, 0, 41, 23, 7, 24, 42, 23, 23, 24, 32, 23, 23, 255, 41, 24, 1, 24, 42, 24, 24, 24, 32, 24, 24, 70, 19, 23, 23, 24, 41, 24, 4, 24, 42, 24, 24, 24, 32, 24, 24, 79, 19, 23, 23, 24, 41, 24, 5, 24, 42, 24, 24, 24, 32, 24, 24, 78, 19, 23, 23, 24, 41, 24, 6, 24, 42, 24, 24, 24, 32, 24, 24, 84, 19, 23, 23, 24, 121, 23, 12, 0, 1, 24, 0, 0, 1, 25, 0, 0, 135, 23, 159, 0, 0, 24, 25, 0, 1, 25, 1, 0, 2, 24, 0, 0, 0, 0, 1, 0, 135, 23, 160, 0, 20, 25, 24, 0, 1, 16, 54, 0, 119, 0, 147, 0, 41, 23, 7, 24, 42, 23, 23, 24, 33, 23, 23, 127, 41, 24, 1, 24, 42, 24, 24, 24, 32, 24, 24, 68, 20, 23, 23, 24, 41, 24, 4, 24, 42, 24, 24, 24, 32, 24, 24, 82, 20, 23, 23, 24, 41, 24, 5, 24, 42, 24, 24, 24, 32, 24, 24, 70, 20, 23, 23, 24, 41, 24, 6, 24, 42, 24, 24, 24, 32, 24, 24, 95, 20, 23, 23, 24, 120, 23, 11, 0, 1, 24, 19, 0, 1, 25, 2, 0, 135, 23, 3, 0, 8, 24, 25, 0, 2, 25, 0, 0, 83, 164, 3, 0, 135, 23, 63, 0, 8, 25, 9, 0, 1, 3, 4, 0, 119, 0, 117, 0, 1, 23, 0, 0, 83, 13, 23, 0, 1, 4, 5, 0, 1, 6, 0, 0, 1, 23, 100, 0, 50, 23, 23, 6, 220, 189, 0, 0, 1, 16, 47, 0, 119, 0, 60, 0, 1, 25, 1, 0, 1, 24, 1, 0, 135, 23, 160, 0, 13, 25, 24, 0, 78, 1, 13, 0, 25, 23, 4, 1, 41, 23, 23, 16, 42, 23, 23, 16, 0, 4, 23, 0, 41, 23, 1, 24, 42, 23, 23, 24, 33, 23, 23, 85, 120, 23, 45, 0, 1, 24, 1, 0, 1, 25, 1, 0, 135, 23, 160, 0, 13, 24, 25, 0, 25, 23, 4, 1, 41, 23, 23, 16, 42, 23, 23, 16, 0, 5, 23, 0, 78, 1, 13, 0, 41, 23, 1, 24, 42, 23, 23, 24, 32, 23, 23, 80, 121, 23, 30, 0, 1, 25, 1, 0, 1, 24, 1, 0, 135, 23, 160, 0, 13, 25, 24, 0, 25, 23, 4, 2, 41, 23, 23, 16, 42, 23, 23, 16, 0, 5, 23, 0, 78, 1, 13, 0, 41, 23, 1, 24, 42, 23, 23, 24, 32, 23, 23, 88, 121, 23, 15, 0, 1, 24, 1, 0, 1, 25, 1, 0, 135, 23, 160, 0, 13, 24, 25, 0, 78, 1, 13, 0, 41, 23, 1, 24, 42, 23, 23, 24, 32, 23, 23, 33, 120, 23, 12, 0, 25, 23, 4, 3, 41, 23, 23, 16, 42, 23, 23, 16, 0, 4, 23, 0, 119, 0, 213, 255, 0, 4, 5, 0, 119, 0, 211, 255, 0, 4, 5, 0, 119, 0, 209, 255, 25, 6, 6, 1, 119, 0, 193, 255, 32, 23, 16, 47, 121, 23, 13, 0, 1, 25, 19, 0, 1, 24, 2, 0, 135, 23, 3, 0, 10, 25, 24, 0, 2, 24, 0, 0, 179, 164, 3, 0, 79, 25, 20, 0, 76, 25, 25, 0, 135, 23, 53, 0, 10, 24, 9, 25, 1, 3, 4, 0, 119, 0, 35, 0, 1, 25, 1, 0, 1, 24, 1, 0, 135, 23, 160, 0, 13, 25, 24, 0, 79, 23, 13, 0, 34, 23, 23, 10, 121, 23, 5, 0, 2, 24, 0, 0, 130, 164, 3, 0, 135, 23, 11, 0, 24, 11, 0, 0, 1, 24, 0, 0, 1, 25, 0, 0, 135, 23, 159, 0, 0, 24, 25, 0, 1, 23, 1, 0, 2, 25, 0, 0, 0, 0, 1, 0, 135, 0, 160, 0, 20, 23, 25, 0, 2, 25, 0, 0, 0, 254, 0, 0, 48, 25, 25, 0, 116, 191, 0, 0, 2, 23, 0, 0, 208, 164, 3, 0, 135, 25, 11, 0, 23, 12, 0, 0, 119, 0, 6, 0, 25, 25, 4, 4, 41, 25, 25, 16, 42, 25, 25, 16, 0, 1, 25, 0, 1, 16, 51, 0, 32, 25, 16, 51, 121, 25, 124, 0, 25, 25, 1, 19, 2, 23, 0, 0, 255, 255, 0, 0, 19, 25, 25, 23, 1, 23, 203, 255, 95, 20, 25, 23, 1, 23, 0, 0, 84, 13, 23, 0, 1, 23, 0, 21, 84, 14, 23, 0, 135, 23, 70, 0, 13, 14, 0, 0, 121, 23, 107, 0, 81, 25, 13, 0, 41, 25, 25, 4, 1, 24, 0, 1, 3, 25, 25, 24, 135, 23, 49, 0, 25, 20, 0, 0, 2, 23, 0, 0, 142, 69, 118, 1, 80, 12, 23, 0, 2, 23, 0, 0, 136, 69, 118, 1, 80, 14, 23, 0, 2, 23, 0, 0, 140, 69, 118, 1, 80, 15, 23, 0, 2, 23, 0, 0, 216, 68, 118, 1, 82, 16, 23, 0, 80, 11, 13, 0, 2, 23, 0, 0, 142, 69, 118, 1, 84, 23, 11, 0, 2, 23, 0, 0, 255, 255, 0, 0, 19, 23, 11, 23, 0, 10, 23, 0, 41, 23, 10, 4, 0, 9, 23, 0, 2, 23, 0, 0, 164, 69, 118, 1, 85, 23, 9, 0, 2, 23, 0, 0, 136, 69, 118, 1, 84, 23, 11, 0, 2, 23, 0, 0, 152, 69, 118, 1, 85, 23, 9, 0, 2, 23, 0, 0, 140, 69, 118, 1, 1, 25, 0, 16, 3, 25, 10, 25, 84, 23, 25, 0, 2, 25, 0, 0, 160, 69, 118, 1, 1, 23, 0, 16, 3, 23, 11, 23, 2, 24, 0, 0, 255, 255, 0, 0, 19, 23, 23, 24, 41, 23, 23, 4, 85, 25, 23, 0, 2, 23, 0, 0, 216, 68, 118, 1, 2, 25, 0, 0, 254, 255, 0, 0, 85, 23, 25, 0, 1, 23, 0, 1, 134, 25, 0, 0, 180, 68, 1, 0, 11, 23, 0, 0, 2, 25, 0, 0, 142, 69, 118, 1, 84, 25, 12, 0, 2, 25, 0, 0, 164, 69, 118, 1, 2, 23, 0, 0, 255, 255, 0, 0, 19, 23, 12, 23, 41, 23, 23, 4, 85, 25, 23, 0, 2, 23, 0, 0, 136, 69, 118, 1, 84, 23, 14, 0, 2, 23, 0, 0, 152, 69, 118, 1, 2, 25, 0, 0, 255, 255, 0, 0, 19, 25, 14, 25, 41, 25, 25, 4, 85, 23, 25, 0, 2, 25, 0, 0, 140, 69, 118, 1, 84, 25, 15, 0, 2, 25, 0, 0, 160, 69, 118, 1, 2, 23, 0, 0, 255, 255, 0, 0, 19, 23, 15, 23, 41, 23, 23, 4, 85, 25, 23, 0, 2, 23, 0, 0, 216, 68, 118, 1, 85, 23, 16, 0, 81, 25, 13, 0, 41, 25, 25, 4, 1, 24, 0, 1, 3, 25, 25, 24, 2, 24, 0, 0, 0, 0, 1, 0, 135, 23, 59, 0, 25, 20, 24, 0, 80, 24, 13, 0, 135, 23, 71, 0, 24, 0, 0, 0, 1, 16, 54, 0, 119, 0, 5, 0, 2, 24, 0, 0, 244, 164, 3, 0, 135, 23, 11, 0, 24, 15, 0, 0, 32, 23, 16, 54, 121, 23, 53, 1, 2, 23, 0, 0, 20, 211, 6, 0, 79, 23, 23, 0, 41, 23, 23, 8, 2, 24, 0, 0, 19, 211, 6, 0, 79, 24, 24, 0, 20, 23, 23, 24, 2, 24, 0, 0, 21, 211, 6, 0, 79, 24, 24, 0, 41, 24, 24, 16, 20, 23, 23, 24, 2, 24, 0, 0, 22, 211, 6, 0, 79, 24, 24, 0, 41, 24, 24, 24, 20, 23, 23, 24, 0, 0, 23, 0, 3, 3, 20, 0, 103, 23, 3, 1, 41, 23, 23, 8, 79, 24, 3, 0, 20, 23, 23, 24, 2, 24, 0, 0, 255, 255, 0, 0, 19, 23, 23, 24, 0, 3, 23, 0, 25, 0, 0, 4, 1, 1, 0, 0, 2, 23, 0, 0, 255, 255, 0, 0, 19, 23, 3, 23, 2, 24, 0, 0, 255, 255, 0, 0, 19, 24, 1, 24, 49, 23, 23, 24, 36, 194, 0, 0, 1, 16, 81, 0, 119, 0, 58, 0, 25, 23, 0, 4, 3, 14, 20, 23, 25, 23, 0, 14, 3, 13, 20, 23, 25, 23, 0, 22, 3, 4, 20, 23, 103, 23, 4, 1, 41, 23, 23, 8, 79, 24, 4, 0, 20, 23, 23, 24, 103, 24, 4, 2, 41, 24, 24, 16, 20, 23, 23, 24, 103, 24, 4, 3, 41, 24, 24, 24, 20, 23, 23, 24, 0, 4, 23, 0, 3, 15, 20, 4, 103, 23, 13, 1, 41, 23, 23, 8, 79, 24, 13, 0, 20, 23, 23, 24, 13, 23, 23, 2, 103, 25, 14, 1, 41, 25, 25, 8, 79, 26, 14, 0, 20, 25, 25, 26, 32, 25, 25, 1, 121, 25, 8, 0, 103, 25, 15, 1, 41, 25, 25, 8, 79, 26, 15, 0, 20, 25, 25, 26, 32, 25, 25, 1, 0, 24, 25, 0, 119, 0, 3, 0, 1, 25, 0, 0, 0, 24, 25, 0, 19, 23, 23, 24, 120, 23, 18, 0, 3, 15, 20, 0, 103, 23, 15, 1, 41, 23, 23, 8, 79, 24, 15, 0, 20, 23, 23, 24, 103, 24, 15, 2, 41, 24, 24, 16, 20, 23, 23, 24, 103, 24, 15, 3, 41, 24, 24, 24, 20, 23, 23, 24, 25, 0, 23, 2, 25, 23, 1, 1, 41, 23, 23, 16, 42, 23, 23, 16, 0, 1, 23, 0, 119, 0, 190, 255, 32, 23, 16, 81, 121, 23, 12, 0, 1, 24, 19, 0, 1, 25, 2, 0, 135, 23, 3, 0, 17, 24, 25, 0, 2, 25, 0, 0, 62, 165, 3, 0, 76, 24, 2, 0, 135, 23, 21, 0, 17, 25, 24, 0, 1, 3, 4, 0, 119, 0, 199, 0, 25, 23, 4, 2, 3, 7, 20, 23, 103, 23, 7, 1, 41, 23, 23, 8, 79, 24, 7, 0, 20, 23, 23, 24, 2, 24, 0, 0, 255, 255, 0, 0, 19, 23, 23, 24, 0, 7, 23, 0, 1, 8, 0, 0, 1, 3, 0, 0, 25, 4, 4, 6, 2, 23, 0, 0, 255, 255, 0, 0, 19, 23, 7, 23, 2, 24, 0, 0, 255, 255, 0, 0, 19, 24, 8, 24, 56, 23, 23, 24, 228, 197, 0, 0, 90, 17, 20, 4, 25, 5, 4, 6, 1, 23, 255, 0, 19, 23, 17, 23, 0, 6, 23, 0, 41, 23, 17, 24, 42, 23, 23, 24, 1, 25, 8, 0, 1, 26, 9, 0, 138, 23, 25, 26, 224, 195, 0, 0, 220, 195, 0, 0, 220, 195, 0, 0, 220, 195, 0, 0, 220, 195, 0, 0, 220, 195, 0, 0, 152, 196, 0, 0, 220, 195, 0, 0, 48, 197, 0, 0, 119, 0, 123, 0, 2, 24, 0, 0, 212, 45, 203, 1, 82, 3, 24, 0, 43, 24, 3, 16, 41, 24, 24, 4, 2, 25, 0, 0, 255, 255, 0, 0, 19, 25, 3, 25, 3, 3, 24, 25, 1, 0, 0, 0, 52, 25, 0, 22, 52, 196, 0, 0, 2, 25, 0, 0, 200, 40, 203, 1, 82, 25, 25, 0, 3, 24, 3, 0, 3, 26, 0, 5, 90, 26, 20, 26, 95, 25, 24, 26, 25, 0, 0, 1, 119, 0, 246, 255, 2, 26, 0, 0, 216, 45, 203, 1, 82, 1, 26, 0, 43, 26, 1, 16, 41, 26, 26, 4, 2, 24, 0, 0, 255, 255, 0, 0, 19, 24, 1, 24, 3, 1, 26, 24, 1, 24, 6, 4, 3, 3, 4, 24, 1, 0, 0, 0, 45, 24, 0, 22, 116, 196, 0, 0, 1, 3, 1, 0, 119, 0, 86, 0, 2, 24, 0, 0, 200, 40, 203, 1, 82, 24, 24, 0, 3, 26, 1, 0, 3, 25, 3, 0, 90, 25, 20, 25, 95, 24, 26, 25, 25, 0, 0, 1, 119, 0, 244, 255, 2, 25, 0, 0, 220, 45, 203, 1, 82, 3, 25, 0, 43, 25, 3, 16, 41, 25, 25, 4, 2, 24, 0, 0, 255, 255, 0, 0, 19, 24, 3, 24, 3, 3, 25, 24, 1, 0, 0, 0, 1, 24, 0, 14, 52, 24, 0, 24, 240, 196, 0, 0, 2, 24, 0, 0, 200, 40, 203, 1, 82, 24, 24, 0, 3, 25, 3, 0, 3, 26, 0, 5, 90, 26, 20, 26, 95, 24, 25, 26, 25, 0, 0, 1, 119, 0, 245, 255, 2, 26, 0, 0, 228, 45, 203, 1, 82, 3, 26, 0, 2, 26, 0, 0, 200, 40, 203, 1, 82, 26, 26, 0, 43, 25, 3, 16, 41, 25, 25, 4, 2, 24, 0, 0, 255, 255, 0, 0, 19, 24, 3, 24, 3, 25, 25, 24, 1, 24, 0, 0, 95, 26, 25, 24, 1, 3, 1, 0, 119, 0, 39, 0, 2, 24, 0, 0, 224, 45, 203, 1, 82, 3, 24, 0, 43, 24, 3, 16, 41, 24, 24, 4, 2, 25, 0, 0, 255, 255, 0, 0, 19, 25, 3, 25, 3, 3, 24, 25, 1, 0, 0, 0, 1, 25, 0, 16, 52, 25, 0, 25, 136, 197, 0, 0, 2, 25, 0, 0, 200, 40, 203, 1, 82, 25, 25, 0, 3, 24, 3, 0, 3, 26, 0, 5, 90, 26, 20, 26, 95, 25, 24, 26, 25, 0, 0, 1, 119, 0, 245, 255, 2, 26, 0, 0, 232, 45, 203, 1, 82, 3, 26, 0, 2, 26, 0, 0, 200, 40, 203, 1, 82, 26, 26, 0, 43, 24, 3, 16, 41, 24, 24, 4, 2, 25, 0, 0, 255, 255, 0, 0, 19, 25, 3, 25, 3, 24, 24, 25, 1, 25, 0, 0, 95, 26, 24, 25, 1, 3, 1, 0, 119, 0, 1, 0, 25, 23, 8, 1, 41, 23, 23, 16, 42, 23, 23, 16, 0, 8, 23, 0, 41, 23, 6, 8, 3, 4, 23, 5, 119, 0, 100, 255, 1, 25, 19, 0, 1, 26, 0, 0, 135, 23, 3, 0, 18, 25, 26, 0, 2, 26, 0, 0, 30, 165, 3, 0, 76, 25, 2, 0, 135, 23, 21, 0, 18, 26, 25, 0, 2, 23, 0, 0, 200, 72, 118, 1, 84, 23, 2, 0, 121, 3, 14, 0, 2, 23, 0, 0, 112, 72, 118, 1, 82, 23, 23, 0, 106, 23, 23, 4, 32, 23, 23, 9, 121, 23, 8, 0, 2, 23, 0, 0, 4, 63, 52, 0, 82, 23, 23, 0, 39, 23, 23, 1, 32, 23, 23, 5, 121, 23, 2, 0, 135, 23, 169, 0, 135, 23, 170, 0, 1, 3, 0, 0, 137, 19, 0, 0, 139, 3, 0, 0, 140, 2, 51, 0, 0, 0, 0, 0, 2, 42, 0, 0, 163, 7, 4, 0, 2, 43, 0, 0, 208, 231, 8, 0, 2, 44, 0, 0, 0, 128, 255, 255, 2, 45, 0, 0, 158, 7, 4, 0, 2, 46, 0, 0, 255, 1, 0, 0, 136, 47, 0, 0, 0, 41, 47, 0, 136, 47, 0, 0, 1, 48, 128, 4, 3, 47, 47, 48, 137, 47, 0, 0, 1, 47, 248, 3, 3, 40, 41, 47, 1, 47, 240, 3, 3, 39, 41, 47, 1, 47, 232, 3, 3, 38, 41, 47, 1, 47, 224, 3, 3, 37, 41, 47, 1, 47, 216, 3, 3, 36, 41, 47, 1, 47, 208, 3, 3, 35, 41, 47, 1, 47, 200, 3, 3, 34, 41, 47, 1, 47, 192, 3, 3, 33, 41, 47, 1, 47, 184, 3, 3, 9, 41, 47, 1, 47, 176, 3, 3, 4, 41, 47, 1, 47, 168, 3, 3, 3, 41, 47, 1, 47, 160, 3, 3, 2, 41, 47, 1, 47, 96, 4, 3, 7, 41, 47, 1, 47, 100, 4, 3, 17, 41, 47, 1, 47, 92, 4, 3, 26, 41, 47, 1, 47, 112, 4, 3, 16, 41, 47, 1, 47, 110, 4, 3, 31, 41, 47, 1, 47, 127, 4, 3, 15, 41, 47, 1, 47, 114, 4, 3, 19, 41, 47, 1, 47, 80, 4, 3, 29, 41, 47, 1, 47, 64, 1, 3, 8, 41, 47, 1, 47, 64, 4, 3, 24, 41, 47, 1, 47, 32, 4, 3, 6, 41, 47, 1, 47, 48, 4, 3, 25, 41, 47, 1, 47, 0, 4, 3, 12, 41, 47, 1, 47, 16, 4, 3, 27, 41, 47, 1, 47, 240, 0, 3, 22, 41, 47, 1, 47, 160, 0, 3, 23, 41, 47, 1, 47, 108, 4, 3, 28, 41, 47, 1, 47, 106, 4, 3, 30, 41, 47, 25, 21, 41, 80, 0, 20, 41, 0, 1, 47, 252, 3, 3, 18, 41, 47, 1, 47, 104, 4, 3, 32, 41, 47, 85, 7, 1, 0, 2, 48, 0, 0, 143, 1, 4, 0, 135, 47, 171, 0, 1, 48, 0, 0, 121, 47, 32, 0, 2, 49, 0, 0, 111, 255, 3, 0, 135, 48, 146, 0, 49, 0, 0, 0, 1, 49, 144, 3, 3, 49, 41, 49, 135, 47, 147, 0, 0, 48, 49, 0, 2, 47, 0, 0, 86, 7, 4, 0, 135, 1, 146, 0, 47, 0, 0, 0, 2, 49, 0, 0, 164, 72, 4, 0, 1, 48, 152, 3], eb + 40960);
  HEAPU8.set([3, 48, 41, 48, 135, 47, 147, 0, 0, 49, 48, 0, 2, 48, 0, 0, 140, 73, 4, 0, 135, 47, 106, 0, 48, 1, 0, 0, 120, 47, 6, 0, 2, 48, 0, 0, 111, 7, 4, 0, 135, 47, 147, 0, 0, 48, 3, 0, 119, 0, 181, 2, 135, 47, 147, 0, 0, 1, 2, 0, 119, 0, 178, 2, 135, 47, 172, 0, 7, 0, 0, 0, 2, 47, 0, 0, 136, 72, 118, 1, 135, 14, 46, 0, 47, 0, 0, 0, 2, 48, 0, 0, 136, 72, 118, 1, 2, 49, 0, 0, 168, 72, 118, 1, 82, 49, 49, 0, 135, 47, 31, 0, 48, 49, 0, 0, 2, 48, 0, 0, 136, 72, 118, 1, 135, 49, 46, 0, 48, 0, 0, 0, 135, 47, 104, 0, 17, 49, 0, 0, 1, 47, 0, 0, 85, 29, 47, 0, 25, 13, 29, 4, 1, 47, 0, 0, 85, 13, 47, 0, 1, 49, 0, 0, 109, 29, 8, 49, 82, 47, 7, 0, 2, 48, 0, 0, 97, 21, 4, 0, 135, 49, 171, 0, 47, 48, 0, 0, 120, 49, 251, 255, 82, 48, 7, 0, 2, 47, 0, 0, 145, 21, 4, 0, 135, 49, 171, 0, 48, 47, 0, 0, 120, 49, 251, 255, 82, 47, 7, 0, 2, 48, 0, 0, 112, 21, 4, 0, 135, 49, 171, 0, 47, 48, 0, 0, 120, 49, 251, 255, 82, 48, 7, 0, 2, 47, 0, 0, 147, 21, 4, 0, 135, 49, 171, 0, 48, 47, 0, 0, 82, 47, 7, 0, 2, 48, 0, 0, 117, 7, 4, 0, 135, 49, 171, 0, 47, 48, 0, 0, 82, 48, 7, 0, 2, 47, 0, 0, 95, 21, 4, 0, 135, 49, 171, 0, 48, 47, 0, 0, 82, 49, 7, 0, 135, 1, 173, 0, 49, 0, 0, 0, 120, 1, 102, 2, 3, 5, 8, 46, 25, 4, 29, 8, 135, 1, 174, 0, 7, 0, 0, 0, 120, 1, 2, 0, 119, 0, 139, 0, 78, 49, 1, 0, 120, 49, 2, 0, 119, 0, 136, 0, 1, 49, 43, 0, 135, 2, 117, 0, 1, 49, 0, 0, 45, 49, 2, 1, 216, 201, 0, 0, 82, 2, 29, 0, 82, 49, 13, 0, 4, 3, 49, 2, 120, 3, 5, 0, 0, 2, 1, 0, 0, 3, 1, 0, 1, 11, 23, 0, 119, 0, 20, 0, 42, 49, 3, 4, 26, 49, 49, 1, 41, 49, 49, 4, 3, 49, 2, 49, 1, 47, 1, 0, 107, 49, 12, 47, 25, 1, 1, 1, 135, 47, 69, 0, 1, 0, 0, 0, 120, 47, 2, 0, 119, 0, 226, 255, 1, 47, 43, 0, 135, 2, 117, 0, 1, 47, 0, 0, 0, 3, 1, 0, 1, 11, 22, 0, 119, 0, 3, 0, 0, 3, 1, 0, 1, 11, 22, 0, 32, 47, 11, 22, 121, 47, 6, 0, 1, 11, 0, 0, 120, 2, 3, 0, 1, 1, 0, 0, 119, 0, 2, 0, 1, 11, 23, 0, 32, 47, 11, 23, 121, 47, 5, 0, 1, 11, 0, 0, 1, 47, 0, 0, 83, 2, 47, 0, 25, 1, 2, 1, 135, 47, 115, 0, 8, 3, 46, 0, 1, 47, 0, 0, 83, 5, 47, 0, 135, 2, 69, 0, 8, 0, 0, 0, 120, 2, 3, 0, 1, 11, 26, 0, 119, 0, 6, 0, 26, 47, 2, 1, 90, 47, 8, 47, 33, 47, 47, 58, 121, 47, 2, 0, 1, 11, 26, 0, 32, 47, 11, 26, 121, 47, 40, 0, 2, 49, 0, 0, 120, 7, 4, 0, 135, 47, 175, 0, 3, 49, 0, 0, 120, 47, 35, 0, 1, 49, 247, 255, 1, 48, 0, 0, 135, 47, 73, 0, 3, 49, 48, 0, 121, 47, 30, 0, 135, 47, 105, 0, 17, 19, 26, 16, 31, 15, 0, 0, 78, 47, 15, 0, 38, 47, 47, 16, 121, 47, 24, 0, 135, 47, 69, 0, 8, 0, 0, 0, 3, 11, 8, 47, 2, 47, 0, 0, 123, 7, 4, 0, 78, 47, 47, 0, 83, 11, 47, 0, 2, 48, 0, 0, 124, 7, 4, 0, 78, 48, 48, 0, 107, 11, 1, 48, 2, 47, 0, 0, 125, 7, 4, 0, 78, 47, 47, 0, 107, 11, 2, 47, 2, 48, 0, 0, 126, 7, 4, 0, 78, 48, 48, 0, 107, 11, 3, 48, 2, 47, 0, 0, 127, 7, 4, 0, 78, 47, 47, 0, 107, 11, 4, 47, 1, 47, 0, 0, 85, 6, 47, 0, 1, 48, 0, 0, 109, 6, 4, 48, 1, 47, 0, 0, 109, 6, 8, 47, 135, 48, 96, 0, 8, 0, 0, 0, 135, 47, 97, 0, 6, 8, 48, 0, 33, 48, 1, 0, 135, 47, 176, 0, 24, 6, 48, 0, 82, 2, 13, 0, 82, 47, 4, 0, 45, 47, 2, 47, 64, 203, 0, 0, 135, 47, 177, 0, 29, 24, 0, 0, 119, 0, 6, 0, 135, 47, 178, 0, 2, 24, 0, 0, 82, 47, 13, 0, 25, 47, 47, 16, 85, 13, 47, 0, 135, 47, 179, 0, 24, 0, 0, 0, 135, 47, 99, 0, 6, 0, 0, 0, 120, 1, 2, 0, 119, 0, 119, 255, 78, 47, 1, 0, 33, 47, 47, 0, 120, 47, 123, 255, 119, 0, 115, 255, 82, 1, 29, 0, 0, 2, 1, 0, 82, 47, 13, 0, 45, 47, 47, 1, 152, 203, 0, 0, 1, 11, 40, 0, 119, 0, 194, 1, 102, 1, 1, 11, 41, 47, 1, 24, 42, 47, 47, 24, 34, 47, 47, 0, 121, 47, 3, 0, 106, 1, 2, 4, 119, 0, 4, 0, 1, 47, 255, 0, 19, 47, 1, 47, 0, 1, 47, 0, 120, 1, 3, 0, 1, 11, 40, 0, 119, 0, 181, 1, 135, 47, 180, 0, 24, 0, 0, 0, 82, 2, 13, 0, 82, 1, 29, 0, 4, 47, 2, 1, 42, 47, 47, 4, 0, 3, 47, 0, 1, 47, 1, 0, 48, 47, 47, 3, 72, 204, 0, 0, 26, 47, 3, 2, 41, 47, 47, 4, 3, 47, 1, 47, 102, 47, 47, 12, 120, 47, 17, 0, 26, 48, 2, 16, 135, 47, 181, 0, 24, 48, 0, 0, 82, 1, 13, 0, 26, 3, 1, 16, 1, 2, 0, 0, 32, 47, 2, 255, 120, 47, 8, 0, 26, 11, 2, 1, 41, 48, 11, 4, 3, 48, 1, 48, 135, 47, 179, 0, 48, 0, 0, 0, 0, 2, 11, 0, 119, 0, 248, 255, 85, 13, 3, 0, 25, 10, 24, 11, 78, 11, 10, 0, 41, 48, 11, 24, 42, 48, 48, 24, 34, 48, 48, 0, 121, 48, 4, 0, 106, 48, 24, 4, 0, 47, 48, 0, 119, 0, 4, 0, 1, 48, 255, 0, 19, 48, 11, 48, 0, 47, 48, 0, 120, 47, 24, 0, 1, 47, 0, 0, 85, 12, 47, 0, 1, 48, 0, 0, 109, 12, 4, 48, 1, 47, 0, 0, 109, 12, 8, 47, 2, 48, 0, 0, 152, 7, 4, 0, 2, 50, 0, 0, 152, 7, 4, 0, 135, 49, 96, 0, 50, 0, 0, 0, 135, 47, 97, 0, 12, 48, 49, 0, 1, 49, 1, 0, 135, 47, 176, 0, 25, 12, 49, 0, 135, 47, 181, 0, 24, 25, 0, 0, 135, 47, 179, 0, 25, 0, 0, 0, 135, 47, 99, 0, 12, 0, 0, 0, 135, 47, 180, 0, 25, 0, 0, 0, 135, 47, 180, 0, 27, 0, 0, 0, 25, 7, 25, 12, 25, 8, 27, 12, 25, 9, 24, 12, 25, 6, 27, 11, 1, 4, 0, 0, 82, 47, 13, 0, 82, 49, 29, 0, 45, 47, 47, 49, 20, 205, 0, 0, 1, 11, 100, 0, 119, 0, 30, 1, 135, 47, 181, 0, 25, 27, 0, 0, 82, 49, 29, 0, 135, 47, 181, 0, 27, 49, 0, 0, 82, 1, 13, 0, 82, 3, 29, 0, 25, 2, 3, 16, 52, 47, 2, 1, 76, 205, 0, 0, 135, 47, 181, 0, 3, 2, 0, 0, 0, 3, 2, 0, 119, 0, 250, 255, 82, 1, 13, 0, 52, 47, 1, 3, 108, 205, 0, 0, 26, 12, 1, 16, 135, 47, 179, 0, 12, 0, 0, 0, 0, 1, 12, 0, 119, 0, 250, 255, 85, 13, 3, 0, 78, 47, 7, 0, 33, 47, 47, 0, 78, 49, 8, 0, 32, 49, 49, 0, 20, 47, 47, 49, 78, 49, 9, 0, 32, 49, 49, 0, 20, 47, 47, 49, 120, 47, 4, 0, 135, 47, 181, 0, 24, 27, 0, 0, 119, 0, 216, 255, 78, 48, 6, 0, 34, 48, 48, 0, 121, 48, 4, 0, 82, 48, 27, 0, 0, 49, 48, 0, 119, 0, 2, 0, 0, 49, 27, 0, 135, 47, 86, 0, 49, 22, 0, 0, 120, 47, 3, 0, 1, 11, 61, 0, 119, 0, 239, 0, 1, 47, 92, 0, 135, 1, 103, 0, 22, 47, 0, 0, 121, 1, 3, 0, 1, 49, 0, 0, 107, 1, 1, 49, 78, 48, 10, 0, 34, 48, 48, 0, 121, 48, 4, 0, 82, 48, 24, 0, 0, 47, 48, 0, 119, 0, 2, 0, 0, 47, 24, 0, 135, 49, 86, 0, 47, 23, 0, 0, 120, 49, 3, 0, 1, 11, 65, 0, 119, 0, 221, 0, 2, 49, 0, 0, 154, 7, 4, 0, 135, 1, 182, 0, 23, 49, 0, 0, 121, 1, 3, 0, 1, 49, 0, 0, 83, 1, 49, 0, 135, 49, 69, 0, 23, 0, 0, 0, 26, 49, 49, 1, 3, 12, 23, 49, 78, 49, 12, 0, 32, 49, 49, 92, 121, 49, 3, 0, 1, 5, 0, 0, 119, 0, 24, 0, 1, 47, 247, 255, 1, 48, 0, 0, 135, 49, 73, 0, 23, 47, 48, 0, 121, 49, 18, 0, 135, 49, 105, 0, 17, 19, 26, 16, 31, 15, 0, 0, 78, 49, 15, 0, 38, 49, 49, 16, 120, 49, 3, 0, 1, 5, 1, 0, 119, 0, 11, 0, 135, 49, 69, 0, 23, 0, 0, 0, 3, 5, 23, 49, 1, 49, 92, 0, 83, 5, 49, 0, 1, 48, 0, 0, 107, 5, 1, 48, 1, 5, 0, 0, 119, 0, 2, 0, 1, 5, 1, 0, 78, 47, 6, 0, 34, 47, 47, 0, 121, 47, 4, 0, 82, 47, 27, 0, 0, 49, 47, 0, 119, 0, 2, 0, 0, 49, 27, 0, 1, 47, 247, 255, 1, 50, 0, 0, 135, 48, 73, 0, 49, 47, 50, 0, 120, 48, 3, 0, 1, 11, 73, 0, 119, 0, 168, 0, 0, 1, 4, 0, 1, 2, 1, 0, 1, 3, 0, 0, 120, 2, 2, 0, 119, 0, 161, 0, 135, 48, 105, 0, 17, 19, 26, 16, 31, 15, 0, 0, 78, 48, 15, 0, 38, 48, 48, 16, 120, 48, 148, 0, 135, 48, 95, 0, 20, 22, 0, 0, 135, 48, 162, 0, 20, 19, 0, 0, 1, 50, 0, 0, 1, 47, 0, 0, 135, 48, 56, 0, 20, 50, 28, 47, 120, 48, 14, 0, 135, 12, 146, 0, 42, 0, 0, 0, 78, 47, 6, 0, 34, 47, 47, 0, 121, 47, 4, 0, 82, 47, 27, 0, 0, 48, 47, 0, 119, 0, 2, 0, 0, 48, 27, 0, 85, 39, 48, 0, 135, 48, 147, 0, 0, 12, 39, 0, 119, 0, 126, 0, 135, 48, 95, 0, 21, 23, 0, 0, 135, 48, 69, 0, 21, 0, 0, 0, 26, 48, 48, 1, 3, 12, 21, 48, 78, 48, 12, 0, 32, 48, 48, 92, 121, 48, 3, 0, 135, 48, 162, 0, 21, 19, 0, 0, 19, 48, 5, 3, 0, 2, 48, 0, 121, 2, 5, 0, 1, 48, 1, 0, 83, 7, 48, 0, 1, 11, 84, 0, 119, 0, 38, 0, 78, 48, 7, 0, 121, 48, 3, 0, 1, 11, 84, 0, 119, 0, 34, 0, 1, 47, 0, 0, 1, 50, 0, 0, 135, 48, 55, 0, 21, 47, 30, 50, 121, 48, 11, 0, 78, 12, 7, 0, 1, 48, 0, 0, 85, 18, 48, 0, 41, 48, 12, 24, 42, 48, 48, 24, 120, 48, 3, 0, 1, 11, 88, 0, 119, 0, 21, 0, 1, 11, 86, 0, 119, 0, 19, 0, 80, 50, 28, 0, 1, 47, 0, 0, 135, 48, 57, 0, 50, 47, 0, 0, 135, 3, 146, 0, 42, 0, 0, 0, 78, 47, 10, 0, 34, 47, 47, 0, 121, 47, 4, 0, 82, 47, 24, 0, 0, 48, 47, 0, 119, 0, 2, 0, 0, 48, 24, 0, 85, 38, 48, 0, 135, 48, 147, 0, 0, 3, 38, 0, 1, 3, 1, 0, 119, 0, 71, 0, 32, 48, 11, 84, 121, 48, 4, 0, 1, 48, 0, 0, 85, 18, 48, 0, 1, 11, 86, 0, 32, 48, 11, 86, 121, 48, 31, 0, 1, 11, 0, 0, 1, 47, 2, 0, 1, 50, 0, 0, 135, 48, 56, 0, 21, 47, 30, 50, 121, 48, 9, 0, 80, 50, 30, 0, 1, 47, 2, 0, 1, 49, 0, 0, 135, 48, 61, 0, 50, 18, 47, 49, 121, 48, 3, 0, 1, 11, 88, 0, 119, 0, 17, 0, 80, 49, 28, 0, 1, 47, 0, 0, 135, 48, 57, 0, 49, 47, 0, 0, 135, 12, 146, 0, 42, 0, 0, 0, 78, 47, 10, 0, 34, 47, 47, 0, 121, 47, 4, 0, 82, 47, 24, 0, 0, 48, 47, 0, 119, 0, 2, 0, 0, 48, 24, 0, 85, 37, 48, 0, 135, 48, 147, 0, 0, 12, 37, 0, 32, 48, 11, 88, 121, 48, 31, 0, 84, 32, 44, 0, 80, 47, 28, 0, 1, 49, 0, 0, 134, 48, 0, 0, 4, 58, 1, 0, 47, 43, 32, 49, 80, 49, 30, 0, 1, 47, 0, 0, 135, 48, 7, 0, 49, 43, 32, 47, 80, 48, 32, 0, 52, 48, 48, 44, 236, 208, 0, 0, 80, 47, 28, 0, 1, 49, 0, 0, 135, 48, 57, 0, 47, 49, 0, 0, 80, 49, 30, 0, 1, 47, 0, 0, 135, 48, 57, 0, 49, 47, 0, 0, 85, 36, 19, 0, 135, 48, 147, 0, 0, 45, 36, 0, 78, 48, 8, 0, 32, 48, 48, 0, 40, 47, 2, 1, 19, 48, 48, 47, 38, 48, 48, 1, 3, 1, 1, 48, 1, 3, 1, 0, 78, 48, 15, 0, 38, 48, 48, 64, 120, 48, 3, 0, 135, 2, 74, 0, 119, 0, 97, 255, 1, 2, 0, 0, 119, 0, 95, 255, 0, 4, 1, 0, 119, 0, 222, 254, 32, 48, 11, 61, 121, 48, 13, 0, 2, 49, 0, 0, 89, 3, 4, 0, 135, 47, 146, 0, 49, 0, 0, 0, 135, 48, 147, 0, 0, 47, 33, 0, 2, 47, 0, 0, 136, 72, 118, 1, 135, 48, 31, 0, 47, 14, 0, 0, 1, 11, 98, 0, 119, 0, 50, 0, 32, 48, 11, 65, 121, 48, 13, 0, 2, 49, 0, 0, 89, 3, 4, 0, 135, 47, 146, 0, 49, 0, 0, 0, 135, 48, 147, 0, 0, 47, 34, 0, 2, 47, 0, 0, 136, 72, 118, 1, 135, 48, 31, 0, 47, 14, 0, 0, 1, 11, 98, 0, 119, 0, 36, 0, 32, 48, 11, 73, 121, 48, 21, 0, 2, 48, 0, 0, 245, 1, 4, 0, 135, 40, 146, 0, 48, 0, 0, 0, 78, 47, 6, 0, 34, 47, 47, 0, 121, 47, 4, 0, 82, 47, 27, 0, 0, 48, 47, 0, 119, 0, 2, 0, 0, 48, 27, 0, 85, 35, 48, 0, 135, 48, 147, 0, 0, 40, 35, 0, 2, 47, 0, 0, 136, 72, 118, 1, 135, 48, 31, 0, 47, 14, 0, 0, 1, 11, 98, 0, 119, 0, 14, 0, 32, 48, 11, 100, 121, 48, 12, 0, 2, 48, 0, 0, 186, 7, 4, 0, 135, 39, 146, 0, 48, 0, 0, 0, 85, 40, 4, 0, 135, 48, 147, 0, 0, 39, 40, 0, 2, 47, 0, 0, 136, 72, 118, 1, 135, 48, 31, 0, 47, 14, 0, 0, 135, 48, 179, 0, 27, 0, 0, 0, 135, 48, 179, 0, 25, 0, 0, 0, 135, 48, 179, 0, 24, 0, 0, 0, 32, 48, 11, 40, 121, 48, 23, 0, 2, 49, 0, 0, 128, 7, 4, 0, 135, 47, 146, 0, 49, 0, 0, 0, 135, 48, 147, 0, 0, 47, 9, 0, 2, 47, 0, 0, 136, 72, 118, 1, 135, 48, 31, 0, 47, 14, 0, 0, 119, 0, 12, 0, 2, 48, 0, 0, 170, 3, 4, 0, 135, 40, 146, 0, 48, 0, 0, 0, 85, 4, 1, 0, 135, 48, 147, 0, 0, 40, 4, 0, 2, 47, 0, 0, 136, 72, 118, 1, 135, 48, 31, 0, 47, 14, 0, 0, 135, 48, 183, 0, 29, 0, 0, 0, 137, 41, 0, 0, 139, 0, 0, 0, 140, 2, 23, 0, 0, 0, 0, 0, 2, 16, 0, 0, 192, 15, 13, 0, 1, 14, 0, 0, 136, 17, 0, 0, 0, 15, 17, 0, 136, 17, 0, 0, 1, 18, 176, 0, 3, 17, 17, 18, 137, 17, 0, 0, 25, 7, 15, 88, 25, 6, 15, 80, 25, 5, 15, 72, 25, 3, 15, 64, 25, 4, 15, 56, 25, 8, 15, 40, 25, 13, 15, 24, 25, 12, 15, 8, 0, 2, 15, 0, 1, 17, 152, 0, 3, 9, 15, 17, 25, 11, 15, 104, 25, 10, 15, 92, 135, 17, 184, 0, 9, 0, 1, 0, 135, 17, 185, 0, 11, 9, 0, 0, 2, 17, 0, 0, 0, 63, 52, 0, 85, 17, 11, 0, 135, 17, 186, 0, 135, 17, 187, 0, 1, 17, 0, 0, 85, 10, 17, 0, 1, 18, 0, 0, 109, 10, 4, 18, 1, 17, 0, 0, 109, 10, 8, 17, 1, 0, 0, 0, 32, 17, 0, 3, 120, 17, 6, 0, 41, 17, 0, 2, 1, 18, 0, 0, 97, 10, 17, 18, 25, 0, 0, 1, 119, 0, 250, 255, 2, 17, 0, 0, 0, 63, 52, 0, 82, 17, 17, 0, 82, 17, 17, 0, 2, 19, 0, 0, 200, 91, 4, 0, 1, 20, 0, 0, 135, 18, 188, 0, 17, 19, 10, 20, 121, 18, 2, 0, 135, 18, 189, 0, 2, 20, 0, 0, 0, 63, 52, 0, 82, 20, 20, 0, 82, 20, 20, 0, 2, 19, 0, 0, 210, 91, 4, 0, 1, 17, 1, 0, 135, 18, 188, 0, 20, 19, 10, 17, 121, 18, 3, 0, 135, 18, 190, 0, 10, 0, 0, 0, 2, 17, 0, 0, 0, 63, 52, 0, 82, 17, 17, 0, 82, 17, 17, 0, 2, 19, 0, 0, 224, 91, 4, 0, 1, 20, 0, 0, 135, 18, 191, 0, 17, 19, 20, 0, 121, 18, 2, 0, 135, 18, 192, 0, 2, 20, 0, 0, 0, 63, 52, 0, 82, 20, 20, 0, 82, 20, 20, 0, 2, 19, 0, 0, 235, 91, 4, 0, 1, 17, 0, 0, 135, 18, 191, 0, 20, 19, 17, 0, 121, 18, 2, 0, 135, 18, 192, 0, 2, 17, 0, 0, 0, 63, 52, 0, 82, 17, 17, 0, 82, 17, 17, 0, 2, 19, 0, 0, 246, 91, 4, 0, 1, 20, 0, 0, 135, 18, 191, 0, 17, 19, 20, 0, 121, 18, 2, 0, 135, 18, 193, 0, 2, 20, 0, 0, 0, 63, 52, 0, 82, 20, 20, 0, 82, 20, 20, 0, 2, 19, 0, 0, 3, 92, 4, 0, 1, 17, 0, 0, 135, 18, 191, 0, 20, 19, 17, 0, 121, 18, 2, 0, 135, 18, 193, 0, 2, 17, 0, 0, 0, 63, 52, 0, 82, 17, 17, 0, 82, 17, 17, 0, 2, 19, 0, 0, 16, 92, 4, 0, 1, 20, 0, 0, 135, 18, 191, 0, 17, 19, 20, 0, 121, 18, 3, 0, 1, 14, 18, 0, 119, 0, 50, 2, 2, 20, 0, 0, 0, 63, 52, 0, 82, 20, 20, 0, 82, 20, 20, 0, 2, 19, 0, 0, 25, 92, 4, 0, 1, 17, 0, 0, 135, 18, 191, 0, 20, 19, 17, 0, 121, 18, 3, 0, 1, 14, 18, 0, 119, 0, 38, 2, 2, 17, 0, 0, 0, 63, 52, 0, 82, 17, 17, 0, 82, 17, 17, 0, 2, 19, 0, 0, 80, 93, 4, 0, 1, 20, 0, 0, 135, 18, 191, 0, 17, 19, 20, 0, 121, 18, 2, 0, 135, 18, 194, 0, 1, 20, 15, 0, 135, 18, 195, 0, 20, 0, 0, 0, 2, 20, 0, 0, 248, 94, 4, 0, 1, 19, 0, 0, 1, 17, 0, 0, 1, 21, 100, 0, 1, 22, 2, 0, 135, 18, 196, 0, 20, 19, 17, 21, 22, 0, 0, 0, 2, 22, 0, 0, 0, 95, 4, 0, 1, 21, 0, 0, 1, 17, 0, 0, 1, 19, 101, 0, 1, 20, 2, 0, 135, 18, 197, 0, 22, 21, 17, 19, 20, 0, 0, 0, 135, 2, 198, 0, 85, 12, 2, 0, 2, 20, 0, 0, 10, 95, 4, 0, 135, 18, 45, 0, 20, 12, 0, 0, 2, 20, 0, 0, 28, 95, 4, 0, 135, 18, 45, 0, 20, 13, 0, 0, 2, 20, 0, 0, 111, 95, 4, 0, 135, 18, 45, 0, 20, 8, 0, 0, 2, 20, 0, 0, 115, 95, 4, 0, 135, 18, 199, 0, 20, 0, 0, 0, 2, 20, 0, 0, 33, 0, 16, 0, 135, 18, 200, 0, 20, 0, 0, 0, 34, 18, 18, 0, 121, 18, 7, 0, 135, 2, 124, 0, 85, 4, 2, 0, 2, 20, 0, 0, 139, 95, 4, 0, 135, 18, 11, 0, 20, 4, 0, 0, 1, 20, 0, 2, 135, 18, 201, 0, 20, 0, 0, 0, 34, 18, 18, 0, 121, 18, 5, 0, 2, 20, 0, 0, 157, 95, 4, 0, 135, 18, 45, 0, 20, 3, 0, 0, 135, 0, 202, 0, 2, 18, 0, 0, 240, 59, 52, 0, 85, 18, 0, 0, 1, 18, 0, 0, 85, 13, 18, 0, 1, 20, 0, 0, 109, 13, 4, 20, 1, 18, 0, 0, 109, 13, 8, 18, 1, 0, 0, 0, 32, 18, 0, 3, 120, 18, 6, 0, 41, 18, 0, 2, 1, 20, 0, 0, 97, 13, 18, 20, 25, 0, 0, 1, 119, 0, 250, 255, 1, 20, 0, 0, 85, 12, 20, 0, 1, 18, 0, 0, 109, 12, 4, 18, 1, 20, 0, 0, 109, 12, 8, 20, 1, 0, 0, 0, 32, 20, 0, 3, 120, 20, 6, 0, 41, 20, 0, 2, 1, 18, 0, 0, 97, 12, 20, 18, 25, 0, 0, 1, 119, 0, 250, 255, 135, 18, 203, 0, 12, 0, 0, 0, 25, 4, 13, 11, 2, 20, 0, 0, 0, 63, 52, 0, 82, 20, 20, 0, 82, 20, 20, 0, 2, 19, 0, 0, 189, 95, 4, 0, 1, 17, 1, 0, 135, 18, 191, 0, 20, 19, 17, 0, 121, 18, 143, 0, 78, 18, 4, 0, 34, 18, 18, 0, 121, 18, 9, 0, 82, 3, 13, 0, 1, 18, 0, 0, 83, 8, 18, 0, 135, 18, 204, 0, 3, 8, 0, 0, 1, 17, 0, 0, 109, 13, 4, 17, 119, 0, 7, 0, 1, 17, 0, 0, 83, 8, 17, 0, 135, 17, 204, 0, 13, 8, 0, 0, 1, 17, 0, 0, 83, 4, 17, 0, 135, 17, 203, 0, 12, 0, 0, 0, 135, 17, 205, 0, 13, 0, 0, 0, 78, 0, 4, 0, 41, 17, 0, 24, 42, 17, 17, 24, 34, 3, 17, 0, 25, 1, 13, 4, 121, 3, 4, 0, 82, 19, 13, 0, 0, 18, 19, 0, 119, 0, 2, 0, 0, 18, 13, 0, 121, 3, 4, 0, 82, 20, 1, 0, 0, 19, 20, 0, 119, 0, 4, 0, 1, 20, 255, 0, 19, 20, 0, 20, 0, 19, 20, 0, 135, 17, 206, 0, 12, 18, 19, 0, 25, 0, 12, 11, 2, 19, 0, 0, 0, 63, 52, 0, 82, 19, 19, 0, 78, 20, 0, 0, 34, 20, 20, 0, 121, 20, 4, 0, 82, 20, 12, 0, 0, 18, 20, 0, 119, 0, 2, 0, 0, 18, 12, 0, 135, 17, 207, 0, 19, 18, 0, 0, 2, 17, 0, 0, 0, 63, 52, 0, 82, 3, 17, 0, 106, 17, 3, 40, 106, 18, 3, 36, 45, 17, 17, 18, 52, 217, 0, 0, 78, 17, 4, 0, 34, 17, 17, 0, 121, 17, 9, 0, 82, 3, 13, 0, 1, 17, 0, 0, 83, 8, 17, 0, 135, 17, 204, 0, 3, 8, 0, 0, 1, 17, 0, 0, 85, 1, 17, 0, 119, 0, 7, 0, 1, 17, 0, 0, 83, 8, 17, 0, 135, 17, 204, 0, 13, 8, 0, 0, 1, 17, 0, 0, 83, 4, 17, 0, 135, 17, 208, 0, 12, 0, 0, 0, 135, 17, 205, 0, 13, 0, 0, 0, 78, 3, 4, 0, 41, 17, 3, 24, 42, 17, 17, 24, 34, 2, 17, 0, 121, 2, 4, 0, 82, 19, 13, 0, 0, 18, 19, 0, 119, 0, 2, 0, 0, 18, 13, 0, 121, 2, 4, 0, 82, 20, 1, 0, 0, 19, 20, 0, 119, 0, 4, 0, 1, 20, 255, 0, 19, 20, 3, 20, 0, 19, 20, 0, 135, 17, 206, 0, 12, 18, 19, 0, 2, 19, 0, 0, 0, 63, 52, 0, 82, 19, 19, 0, 78, 20, 0, 0, 34, 20, 20, 0, 121, 20, 4, 0, 82, 20, 12, 0, 0, 18, 20, 0, 119, 0, 2, 0, 0, 18, 12, 0, 135, 17, 209, 0, 19, 18, 0, 0, 121, 17, 27, 0, 78, 18, 0, 0, 34, 18, 18, 0, 121, 18, 4, 0, 82, 18, 12, 0, 0, 17, 18, 0, 119, 0, 2, 0, 0, 17, 12, 0, 85, 5, 17, 0, 2, 18, 0, 0, 199, 95, 4, 0, 135, 17, 45, 0, 18, 5, 0, 0, 2, 18, 0, 0, 0, 63, 52, 0, 82, 18, 18, 0, 78, 20, 0, 0, 34, 20, 20, 0, 121, 20, 4, 0, 82, 20, 12, 0, 0, 19, 20, 0, 119, 0, 2, 0, 0, 19, 12, 0, 135, 17, 207, 0, 18, 19, 0, 0, 0, 3, 13, 0, 119, 0, 6, 0, 0, 3, 13, 0, 119, 0, 4, 0, 0, 3, 13, 0, 119, 0, 2, 0, 0, 3, 13, 0, 25, 0, 8, 11, 2, 17, 0, 0, 0, 63, 52, 0, 82, 17, 17, 0, 82, 17, 17, 0, 2, 19, 0, 0, 2, 96, 4, 0, 1, 18, 1, 0, 135, 5, 188, 0, 17, 19, 13, 18, 2, 18, 0, 0, 0, 63, 52, 0, 82, 2, 18, 0, 120, 5, 2, 0, 119, 0, 28, 0, 78, 17, 4, 0, 34, 17, 17, 0, 121, 17, 4, 0, 82, 17, 3, 0, 0, 19, 17, 0, 119, 0, 2, 0, 0, 19, 13, 0, 135, 18, 207, 0, 2, 19, 0, 0, 120, 18, 233, 255, 2, 18, 0, 0, 0, 63, 52, 0, 82, 5, 18, 0, 135, 18, 210, 0, 8, 12, 13, 0, 78, 17, 0, 0, 34, 17, 17, 0, 121, 17, 4, 0, 82, 17, 8, 0, 0, 19, 17, 0, 119, 0, 2, 0, 0, 19, 8, 0, 135, 18, 207, 0, 5, 19, 0, 0, 135, 18, 99, 0, 8, 0, 0, 0, 119, 0, 216, 255, 106, 1, 2, 40, 106, 0, 2, 36, 45, 18, 1, 0, 28, 218, 0, 0, 2, 19, 0, 0, 8, 96, 4, 0, 135, 18, 207, 0, 2, 19, 0, 0, 2, 18, 0, 0, 0, 63, 52, 0, 82, 0, 18, 0, 106, 1, 0, 40, 106, 0, 0, 36, 45, 18, 1, 0, 196, 218, 0, 0, 78, 18, 4, 0, 34, 18, 18, 0, 121, 18, 9, 0, 82, 5, 3, 0, 1, 18, 0, 0, 83, 8, 18, 0, 135, 18, 204, 0, 5, 8, 0, 0, 1, 19, 0, 0, 109, 13, 4, 19, 119, 0, 7, 0, 1, 19, 0, 0, 83, 8, 19, 0, 135, 19, 204, 0, 13, 8, 0, 0, 1, 19, 0, 0, 83, 4, 19, 0, 135, 19, 205, 0, 13, 0, 0, 0, 2, 19, 0, 0, 0, 63, 52, 0, 82, 0, 19, 0, 135, 19, 210, 0, 8, 12, 13, 0, 102, 17, 8, 11, 34, 17, 17, 0, 121, 17, 4, 0, 82, 17, 8, 0, 0, 18, 17, 0, 119, 0, 2, 0, 0, 18, 8, 0, 135, 19, 207, 0, 0, 18, 0, 0, 135, 19, 99, 0, 8, 0, 0, 0, 2, 19, 0, 0, 0, 63, 52, 0, 82, 0, 19, 0, 106, 1, 0, 40, 106, 0, 0, 36, 45, 19, 1, 0, 24, 220, 0, 0, 78, 19, 4, 0, 34, 19, 19, 0, 121, 19, 9, 0, 82, 5, 3, 0, 1, 19, 0, 0, 83, 8, 19, 0, 135, 19, 204, 0, 5, 8, 0, 0, 1, 18, 0, 0, 109, 13, 4, 18, 119, 0, 7, 0, 1, 18, 0, 0, 83, 8, 18, 0, 135, 18, 204, 0, 13, 8, 0, 0, 1, 18, 0, 0, 83, 4, 18, 0, 135, 18, 208, 0, 12, 0, 0, 0, 135, 18, 205, 0, 13, 0, 0, 0, 78, 0, 4, 0, 41, 18, 0, 24, 42, 18, 18, 24, 34, 5, 18, 0, 121, 5, 4, 0, 82, 17, 3, 0, 0, 19, 17, 0, 119, 0, 2, 0, 0, 19, 13, 0, 121, 5, 4, 0, 106, 20, 13, 4, 0, 17, 20, 0, 119, 0, 4, 0, 1, 20, 255, 0, 19, 20, 0, 20, 0, 17, 20, 0, 135, 18, 206, 0, 12, 19, 17, 0, 25, 0, 12, 11, 2, 17, 0, 0, 0, 63, 52, 0, 82, 17, 17, 0, 78, 20, 0, 0, 34, 20, 20, 0, 121, 20, 4, 0, 82, 20, 12, 0, 0, 19, 20, 0, 119, 0, 2, 0, 0, 19, 12, 0, 135, 18, 209, 0, 17, 19, 0, 0, 121, 18, 26, 0, 78, 19, 0, 0, 34, 19, 19, 0, 121, 19, 4, 0, 82, 19, 12, 0, 0, 18, 19, 0, 119, 0, 2, 0, 0, 18, 12, 0, 85, 6, 18, 0, 2, 19, 0, 0, 199, 95, 4, 0, 135, 18, 45, 0, 19, 6, 0, 0, 2, 19, 0, 0, 0, 63, 52, 0, 82, 19, 19, 0, 78, 20, 0, 0, 34, 20, 20, 0, 121, 20, 4, 0, 82, 20, 12, 0, 0, 17, 20, 0, 119, 0, 2, 0, 0, 17, 12, 0, 135, 18, 207, 0, 19, 17, 0, 0, 119, 0, 6, 0, 2, 17, 0, 0, 20, 96, 4, 0, 135, 18, 45, 0, 17, 7, 0, 0, 119, 0, 1, 0, 2, 17, 0, 0, 0, 63, 52, 0, 82, 17, 17, 0, 2, 19, 0, 0, 4, 44, 203, 1, 82, 19, 19, 0, 135, 18, 211, 0, 17, 19, 0, 0, 2, 19, 0, 0, 0, 63, 52, 0, 82, 19, 19, 0, 134, 18, 0, 0, 192, 73, 1, 0, 19, 0, 0, 0, 2, 18, 0, 0, 0, 63, 52, 0, 82, 0, 18, 0, 1, 18, 0, 0, 85, 8, 18, 0, 1, 19, 0, 0, 109, 8, 4, 19, 1, 18, 0, 0, 109, 8, 8, 18, 2, 19, 0, 0, 170, 84, 4, 0, 2, 20, 0, 0, 170, 84, 4, 0, 135, 17, 96, 0, 20, 0, 0, 0, 135, 18, 97, 0, 8, 19, 17, 0, 135, 0, 212, 0, 0, 8, 0, 0, 135, 18, 99, 0, 8, 0, 0, 0, 2, 17, 0, 0, 0, 63, 52, 0, 82, 17, 17, 0, 82, 17, 17, 0, 2, 19, 0, 0, 87, 96, 4, 0, 1, 20, 0, 0, 135, 18, 191, 0, 17, 19, 20, 0, 121, 18, 3, 0, 1, 0, 1, 0, 119, 0, 19, 0, 1, 18, 0, 0, 85, 8, 18, 0, 1, 20, 0, 0, 109, 8, 4, 20, 1, 18, 0, 0, 109, 8, 8, 18, 2, 20, 0, 0, 174, 84, 4, 0, 2, 17, 0, 0, 174, 84, 4, 0, 135, 19, 96, 0, 17, 0, 0, 0, 135, 18, 97, 0, 8, 20, 19, 0, 135, 0, 110, 0, 0, 8, 0, 0, 135, 18, 99, 0, 8, 0, 0, 0, 2, 18, 0, 0, 144, 59, 52, 0, 78, 18, 18, 0, 32, 18, 18, 0, 19, 18, 0, 18, 121, 18, 2, 0, 135, 18, 213, 0, 135, 18, 214, 0, 2, 19, 0, 0, 0, 63, 52, 0, 82, 19, 19, 0, 82, 19, 19, 0, 2, 20, 0, 0, 99, 96, 4, 0, 1, 17, 0, 0, 135, 18, 191, 0, 19, 20, 17, 0, 121, 18, 3, 0, 134, 18, 0, 0, 220, 48, 1, 0, 2, 17, 0, 0, 0, 63, 52, 0, 82, 17, 17, 0, 134, 18, 0, 0, 144, 74, 1, 0, 17, 0, 0, 0, 135, 18, 99, 0, 12, 0, 0, 0, 135, 18, 99, 0, 13, 0, 0, 0, 135, 18, 99, 0, 10, 0, 0, 0, 135, 18, 215, 0, 11, 0, 0, 0, 135, 18, 216, 0, 9, 0, 0, 0, 1, 17, 0, 0, 135, 18, 217, 0, 17, 0, 0, 0, 1, 17, 1, 0, 135, 18, 120, 0, 17, 0, 0, 0, 135, 18, 218, 0, 32, 18, 14, 18, 121, 18, 30, 0, 2, 18, 0, 0, 32, 91, 4, 0, 85, 2, 18, 0, 2, 17, 0, 0, 35, 92, 4, 0, 135, 18, 219, 0, 17, 2, 0, 0, 2, 17, 0, 0, 90, 92, 4, 0, 135, 18, 220, 0, 17, 0, 0, 0, 2, 17, 0, 0, 147, 92, 4, 0, 135, 18, 220, 0, 17, 0, 0, 0, 2, 17, 0, 0, 213, 92, 4, 0, 135, 18, 220, 0, 17, 0, 0, 0, 2, 17, 0, 0, 22, 93, 4, 0, 135, 18, 220, 0, 17, 0, 0, 0, 135, 18, 99, 0, 10, 0, 0, 0, 135, 18, 215, 0, 11, 0, 0, 0, 135, 18, 216, 0, 9, 0, 0, 0, 137, 15, 0, 0, 1, 18, 0, 0, 139, 18, 0, 0, 140, 2, 46, 0, 0, 0, 0, 0, 2, 38, 0, 0, 39, 108, 4, 0, 2, 39, 0, 0, 125, 46, 203, 1, 2, 40, 0, 0, 40, 9, 4, 0, 2, 41, 0, 0, 45, 9, 4, 0, 1, 29, 0, 0, 136, 42, 0, 0, 0, 37, 42, 0, 136, 42, 0, 0, 1, 43, 96, 3, 3, 42, 42, 43, 137, 42, 0, 0, 1, 42, 16, 3, 3, 36, 37, 42, 1, 42, 8, 3, 3, 33, 37, 42, 1, 42, 0, 3, 3, 28, 37, 42, 1, 42, 224, 2, 3, 27, 37, 42, 1, 42, 216, 2, 3, 26, 37, 42, 1, 42, 184, 2, 3, 25, 37, 42, 1, 42, 176, 2, 3, 24, 37, 42, 1, 42, 168, 2, 3, 23, 37, 42, 1, 42, 160, 2, 3, 22, 37, 42, 1, 42, 152, 2, 3, 10, 37, 42, 1, 42, 144, 2, 3, 8, 37, 42, 1, 42, 136, 2, 3, 9, 37, 42, 1, 42, 128, 2, 3, 5, 37, 42, 1, 42, 120, 2, 3, 4, 37, 42, 1, 42, 112, 2, 3, 3, 37, 42, 1, 42, 80, 2, 3, 35, 37, 42, 1, 42, 0, 2, 3, 6, 37, 42, 1, 42, 64, 3, 3, 34, 37, 42, 0, 7, 37, 0, 1, 42, 52, 3, 3, 20, 37, 42, 1, 42, 36, 3, 3, 31, 37, 42, 1, 42, 24, 3, 3, 32, 37, 42, 1, 42, 78, 3, 3, 30, 37, 42, 1, 42, 76, 3, 3, 21, 37, 42, 1, 42, 80, 3, 3, 19, 37, 42, 2, 43, 0, 0, 143, 1, 4, 0, 135, 42, 171, 0, 1, 43, 0, 0, 121, 42, 32, 0, 2, 44, 0, 0, 207, 254, 3, 0, 135, 43, 146, 0, 44, 0, 0, 0, 1, 44, 96, 2, 3, 44, 37, 44, 135, 42, 147, 0, 0, 43, 44, 0, 2, 42, 0, 0, 231, 8, 4, 0, 135, 2, 146, 0, 42, 0, 0, 0, 2, 44, 0, 0, 164, 72, 4, 0, 1, 43, 104, 2, 3, 43, 37, 43, 135, 42, 147, 0, 0, 44, 43, 0, 2, 43, 0, 0, 140, 73, 4, 0, 135, 42, 106, 0, 43, 2, 0, 0, 120, 42, 6, 0, 2, 43, 0, 0, 255, 8, 4, 0, 135, 42, 147, 0, 0, 43, 4, 0, 119, 0, 44, 2, 135, 42, 147, 0, 0, 2, 3, 0, 119, 0, 41, 2, 1, 42, 0, 0, 85, 34, 42, 0, 1, 43, 0, 0, 109, 34, 4, 43, 1, 42, 0, 0, 109, 34, 8, 42, 1, 2, 0, 0, 32, 42, 2, 3, 120, 42, 6, 0, 41, 42, 2, 2, 1, 43, 0, 0, 97, 34, 42, 43, 25, 2, 2, 1, 119, 0, 250, 255, 2, 42, 0, 0, 4, 9, 4, 0, 135, 43, 221, 0, 0, 42, 34, 0, 121, 43, 81, 0, 1, 44, 61, 0, 1, 45, 0, 0, 135, 42, 222, 0, 34, 44, 45, 0, 25, 42, 42, 1, 1, 45, 255, 255, 135, 43, 223, 0, 7, 34, 42, 45, 34, 0, 0, 0, 1, 43, 0, 0, 85, 32, 43, 0, 1, 45, 0, 0, 109, 32, 4, 45, 1, 43, 0, 0, 109, 32, 8, 43, 135, 45, 96, 0, 1, 0, 0, 0, 135, 43, 97, 0, 32, 1, 45, 0, 1, 43, 0, 0, 85, 31, 43, 0, 1, 45, 0, 0, 109, 31, 4, 45, 1, 43, 0, 0, 109, 31, 8, 43, 1, 2, 0, 0, 32, 43, 2, 3, 120, 43, 6, 0, 41, 43, 2, 2, 1, 45, 0, 0, 97, 31, 43, 45, 25, 2, 2, 1, 119, 0, 250, 255, 25, 17, 32, 11, 78, 18, 17, 0, 41, 43, 18, 24, 42, 43, 43, 24, 34, 43, 43, 0, 121, 43, 4, 0, 106, 43, 32, 4, 0, 45, 43, 0, 119, 0, 4, 0, 1, 43, 255, 0, 19, 43, 18, 43, 0, 45, 43, 0, 0, 18, 45, 0, 135, 1, 96, 0, 38, 0, 0, 0, 78, 42, 17, 0, 34, 42, 42, 0, 121, 42, 4, 0, 82, 42, 32, 0, 0, 43, 42, 0, 119, 0, 2, 0, 0, 43, 32, 0, 3, 42, 18, 1, 135, 45, 224, 0, 31, 43, 18, 42, 135, 45, 206, 0, 31, 38, 1, 0, 135, 45, 210, 0, 20, 31, 7, 0, 135, 45, 151, 0, 34, 20, 0, 0, 135, 45, 99, 0, 20, 0, 0, 0, 135, 45, 99, 0, 31, 0, 0, 0, 135, 45, 99, 0, 32, 0, 0, 0, 102, 42, 34, 11, 34, 42, 42, 0, 121, 42, 4, 0, 82, 42, 34, 0, 0, 45, 42, 0, 119, 0, 2, 0, 0, 45, 34, 0, 0, 1, 45, 0, 135, 45, 99, 0, 7, 0, 0, 0, 2, 45, 0, 0, 139, 21, 4, 0, 135, 3, 171, 0, 1, 45, 0, 0, 2, 42, 0, 0, 114, 21, 4, 0, 135, 45, 171, 0, 1, 42, 0, 0, 2, 45, 0, 0, 155, 21, 4, 0, 135, 2, 171, 0, 1, 45, 0, 0, 2, 42, 0, 0, 11, 9, 4, 0, 135, 45, 171, 0, 1, 42, 0, 0, 121, 45, 3, 0, 1, 29, 15, 0, 119, 0, 7, 0, 2, 42, 0, 0, 14, 9, 4, 0, 135, 45, 171, 0, 1, 42, 0, 0, 121, 45, 2, 0, 1, 29, 15, 0, 32, 45, 29, 15, 121, 45, 3, 0, 1, 2, 1, 0, 1, 3, 1, 0, 2, 45, 0, 0, 97, 21, 4, 0, 135, 17, 171, 0, 1, 45, 0, 0, 2, 45, 0, 0, 17, 9, 4, 0, 135, 18, 171, 0, 1, 45, 0, 0, 135, 4, 173, 0, 1, 0, 0, 0, 120, 4, 149, 1, 135, 4, 225, 0, 1, 0, 0, 0, 135, 1, 69, 0, 4, 0, 0, 0, 120, 1, 4, 0, 0, 1, 4, 0, 1, 29, 21, 0, 119, 0, 48, 0, 26, 45, 1, 1, 90, 45, 4, 45, 1, 42, 58, 0, 1, 43, 35, 0, 138, 45, 42, 43, 216, 226, 0, 0, 212, 226, 0, 0, 212, 226, 0, 0, 212, 226, 0, 0, 212, 226, 0, 0, 212, 226, 0, 0, 212, 226, 0, 0, 212, 226, 0, 0, 212, 226, 0, 0, 212, 226, 0, 0, 212, 226, 0, 0, 212, 226, 0, 0, 212, 226, 0, 0, 212, 226, 0, 0, 212, 226, 0, 0, 212, 226, 0, 0, 212, 226, 0, 0, 212, 226, 0, 0, 212, 226, 0, 0, 212, 226, 0, 0, 212, 226, 0, 0, 212, 226, 0, 0, 212, 226, 0, 0, 212, 226, 0, 0, 212, 226, 0, 0, 212, 226, 0, 0, 212, 226, 0, 0, 212, 226, 0, 0, 212, 226, 0, 0, 212, 226, 0, 0, 212, 226, 0, 0, 212, 226, 0, 0, 212, 226, 0, 0, 212, 226, 0, 0, 220, 226, 0, 0, 119, 0, 7, 0, 119, 0, 2, 0, 119, 0, 1, 0, 135, 45, 69, 0, 4, 0, 0, 0, 3, 1, 4, 45, 1, 29, 21, 0, 32, 45, 29, 21, 121, 45, 9, 0, 1, 45, 42, 0, 83, 1, 45, 0, 1, 42, 46, 0, 107, 1, 1, 42, 1, 45, 42, 0, 107, 1, 2, 45, 1, 42, 0, 0, 107, 1, 3, 42, 135, 1, 226, 0, 4, 7, 0, 0, 1, 45, 42, 0, 135, 42, 103, 0, 1, 45, 0, 0, 120, 42, 36, 0, 1, 45, 63, 0, 135, 42, 103, 0, 1, 45, 0, 0, 120, 42, 32, 0, 1, 42, 0, 0, 84, 20, 42, 0, 135, 42, 62, 0, 1, 20, 0, 0, 121, 42, 27, 0, 80, 42, 20, 0, 38, 42, 42, 16, 121, 42, 24, 0, 135, 42, 69, 0, 1, 0, 0, 0, 3, 16, 7, 42, 2, 42, 0, 0, 123, 7, 4, 0, 78, 42, 42, 0, 83, 16, 42, 0, 2, 45, 0, 0, 124, 7, 4, 0, 78, 45, 45, 0, 107, 16, 1, 45, 2, 42, 0, 0, 125, 7, 4, 0, 78, 42, 42, 0, 107, 16, 2, 42, 2, 45, 0, 0, 126, 7, 4, 0, 78, 45, 45, 0, 107, 16, 3, 45, 2, 42, 0, 0, 127, 7, 4, 0, 78, 42, 42, 0, 107, 16, 4, 42, 1, 45, 46, 0, 135, 42, 103, 0, 1, 45, 0, 0, 120, 42, 16, 0, 135, 42, 69, 0, 1, 0, 0, 0, 3, 16, 7, 42, 2, 42, 0, 0, 248, 110, 4, 0, 78, 42, 42, 0, 83, 16, 42, 0, 2, 45, 0, 0, 249, 110, 4, 0, 78, 45, 45, 0, 107, 16, 1, 45, 2, 42, 0, 0, 250, 110, 4, 0, 78, 42, 42, 0, 107, 16, 2, 42, 135, 42, 86, 0, 1, 6, 0, 0, 121, 42, 14, 1, 1, 45, 92, 0, 135, 42, 103, 0, 6, 45, 0, 0, 25, 16, 42, 1, 1, 42, 0, 0, 83, 16, 42, 0, 120, 17, 8, 0, 2, 42, 0, 0, 20, 9, 4, 0, 135, 16, 146, 0, 42, 0, 0, 0, 85, 8, 6, 0, 135, 42, 147, 0, 0, 16, 8, 0, 2, 42, 0, 0, 136, 72, 118, 1, 135, 16, 46, 0, 42, 0, 0, 0, 2, 45, 0, 0, 136, 72, 118, 1, 2, 43, 0, 0, 168, 72, 118, 1, 82, 43, 43, 0, 135, 42, 31, 0, 45, 43, 0, 0, 2, 45, 0, 0, 136, 72, 118, 1, 135, 43, 46, 0, 45, 0, 0, 0, 135, 42, 104, 0, 20, 43, 0, 0, 1, 43, 247, 255, 1, 45, 0, 0, 135, 42, 73, 0, 1, 43, 45, 0, 121, 42, 221, 0, 1, 42, 110, 0, 1, 45, 22, 0, 125, 15, 3, 42, 45, 0, 0, 0, 38, 45, 3, 1, 0, 14, 45, 0, 1, 13, 0, 0, 1, 4, 0, 0, 1, 5, 0, 0, 1, 6, 0, 0, 1, 7, 0, 0, 135, 45, 105, 0, 20, 31, 32, 30, 21, 19, 0, 0, 121, 18, 8, 0, 78, 45, 19, 0, 38, 45, 45, 16, 120, 45, 3, 0, 0, 1, 13, 0, 119, 0, 4, 0, 1, 29, 41, 0, 119, 0, 2, 0, 1, 29, 41, 0, 32, 45, 29, 41, 121, 45, 133, 0, 1, 29, 0, 0, 121, 17, 22, 0, 2, 42, 0, 0, 179, 114, 4, 0, 135, 45, 106, 0, 42, 31, 0, 0, 120, 45, 3, 0, 0, 1, 13, 0, 119, 0, 117, 0, 2, 42, 0, 0, 190, 60, 4, 0, 135, 45, 106, 0, 42, 31, 0, 0, 120, 45, 3, 0, 0, 1, 13, 0, 119, 0, 110, 0, 85, 22, 31, 0, 2, 42, 0, 0, 171, 59, 4, 0, 135, 45, 147, 0, 0, 42, 22, 0, 0, 1, 13, 0, 119, 0, 103, 0, 78, 45, 31, 0, 32, 45, 45, 46, 20, 45, 3, 45, 121, 45, 4, 0, 2, 12, 0, 0, 125, 46, 203, 1, 119, 0, 11, 0, 1, 45, 46, 0, 135, 1, 103, 0, 31, 45, 0, 0, 120, 1, 4, 0, 2, 12, 0, 0, 125, 46, 203, 1, 119, 0, 4, 0, 1, 45, 0, 0, 83, 1, 45, 0, 25, 12, 1, 1, 81, 1, 30, 0, 38, 45, 1, 31, 0, 8, 45, 0, 43, 45, 1, 5, 38, 45, 45, 15, 0, 9, 45, 0, 43, 45, 1, 9, 1, 42, 188, 7, 3, 1, 45, 42, 80, 10, 21, 0, 2, 42, 0, 0, 255, 255, 0, 0, 19, 42, 10, 42, 43, 42, 42, 11, 2, 45, 0, 0, 255, 255, 0, 0, 19, 42, 42, 45, 0, 11, 42, 0, 2, 42, 0, 0, 255, 255, 0, 0, 19, 42, 10, 42, 43, 42, 42, 5, 38, 42, 42, 63, 0, 10, 42, 0, 78, 42, 19, 0, 38, 42, 42, 16, 120, 42, 27, 0, 121, 3, 7, 0, 85, 26, 31, 0, 2, 45, 0, 0, 94, 9, 4, 0, 135, 42, 147, 0, 0, 45, 26, 0, 119, 0, 16, 0, 82, 45, 32, 0, 135, 42, 227, 0, 45, 35, 0, 0, 85, 27, 31, 0, 109, 27, 4, 12, 109, 27, 8, 35, 109, 27, 12, 8, 109, 27, 16, 9, 109, 27, 20, 1, 109, 27, 24, 11, 109, 27, 28, 10, 2, 45, 0, 0, 100, 9, 4, 0, 135, 42, 147, 0, 0, 45, 27, 0, 82, 42, 32, 0, 3, 1, 42, 13, 25, 5, 5, 1, 119, 0, 32, 0, 121, 3, 17, 0, 85, 23, 31, 0, 135, 42, 147, 0, 0, 40, 23, 0, 135, 1, 69, 0, 31, 0, 0, 0, 1, 42, 15, 0, 57, 42, 42, 1, 240, 230, 0, 0, 1, 42, 14, 0, 4, 1, 42, 1, 120, 1, 2, 0, 119, 0, 17, 0, 135, 42, 147, 0, 0, 38, 24, 0, 26, 1, 1, 1, 119, 0, 251, 255, 85, 25, 31, 0, 109, 25, 4, 12, 2, 45, 0, 0, 88, 9, 4, 0, 109, 25, 8, 45, 109, 25, 12, 8, 109, 25, 16, 9, 109, 25, 20, 1, 109, 25, 24, 11, 109, 25, 28, 10, 135, 45, 147, 0, 0, 41, 25, 0, 0, 1, 13, 0, 25, 4, 4, 1, 3, 7, 7, 14, 121, 2, 7, 0, 25, 6, 6, 1, 9, 45, 6, 15, 120, 45, 4, 0, 134, 45, 0, 0, 252, 56, 1, 0, 0, 39, 0, 0, 135, 45, 74, 0, 121, 45, 3, 0, 0, 13, 1, 0, 119, 0, 107, 255, 31, 45, 7, 5, 32, 45, 45, 0, 40, 42, 3, 1, 20, 45, 45, 42, 120, 45, 5, 0, 2, 42, 0, 0, 164, 72, 4, 0, 135, 45, 147, 0, 0, 42, 28, 0, 120, 17, 45, 0, 135, 45, 227, 0, 1, 35, 0, 0, 2, 45, 0, 0, 142, 9, 4, 0, 135, 2, 146, 0, 45, 0, 0, 0, 85, 33, 5, 0, 109, 33, 4, 35, 135, 45, 147, 0, 0, 2, 33, 0, 2, 45, 0, 0, 96, 215, 8, 0, 135, 42, 228, 0, 20, 0, 0, 0, 1, 43, 255, 0, 19, 42, 42, 43, 41, 42, 42, 2, 3, 2, 45, 42, 82, 2, 2, 0, 120, 2, 4, 0, 2, 2, 0, 0, 0, 0, 64, 6, 119, 0, 12, 0, 82, 45, 2, 0, 106, 45, 45, 48, 38, 45, 45, 31, 135, 42, 229, 0, 45, 2, 33, 31, 32, 30, 0, 0, 79, 42, 31, 0, 81, 45, 33, 0, 5, 2, 42, 45, 81, 45, 30, 0, 5, 2, 2, 45, 135, 45, 227, 0, 2, 35, 0, 0, 2, 45, 0, 0, 167, 9, 4, 0, 135, 33, 146, 0, 45, 0, 0, 0, 85, 36, 4, 0, 109, 36, 4, 35, 135, 45, 147, 0, 0, 33, 36, 0, 2, 42, 0, 0, 136, 72, 118, 1, 135, 45, 31, 0, 42, 16, 0, 0, 119, 0, 28, 0, 120, 17, 8, 0, 2, 45, 0, 0, 245, 1, 4, 0, 135, 36, 146, 0, 45, 0, 0, 0, 85, 10, 1, 0, 135, 45, 147, 0, 0, 36, 10, 0, 2, 42, 0, 0, 136, 72, 118, 1, 135, 45, 31, 0, 42, 16, 0, 0, 119, 0, 15, 0, 2, 43, 0, 0, 89, 3, 4, 0, 135, 42, 146, 0, 43, 0, 0, 0, 135, 45, 147, 0, 0, 42, 9, 0, 119, 0, 8, 0, 2, 45, 0, 0, 170, 3, 4, 0, 135, 36, 146, 0, 45, 0, 0, 0, 85, 5, 4, 0, 135, 45, 147, 0, 0, 36, 5, 0, 135, 45, 99, 0, 34, 0, 0, 0, 137, 37, 0, 0, 139, 0, 0, 0, 140, 3, 20, 0, 0, 0, 0, 0, 2, 12, 0, 0, 250, 0, 0, 0, 2, 13, 0, 0, 255, 255, 0, 0, 2, 14, 0, 0, 0, 1, 0, 0, 136, 15, 0, 0, 0, 11, 15, 0, 136, 15, 0, 0, 1, 16, 80, 18, 3, 15, 15, 16, 137, 15, 0, 0, 1, 15, 200, 17, 3, 4, 11, 15, 1, 15, 112, 17, 3, 6, 11, 15, 1, 15, 112, 1, 3, 7, 11, 15, 1, 15, 16, 1, 3, 10, 11, 15, 1, 15, 208, 17, 3, 5, 11, 15, 0, 9, 11, 0, 1, 15, 204, 17, 3, 8, 11, 15, 78, 15, 2, 0, 1, 17, 0, 0, 1, 16, 33, 0, 138, 15, 17, 16, 188, 233, 0, 0, 144, 233, 0, 0, 144, 233, 0, 0, 144, 233, 0, 0, 144, 233, 0, 0, 144, 233, 0, 0, 144, 233, 0, 0, 144, 233, 0, 0, 144, 233, 0, 0, 144, 233, 0, 0, 144, 233, 0, 0, 144, 233, 0, 0, 144, 233, 0, 0, 144, 233, 0, 0, 144, 233, 0, 0, 144, 233, 0, 0, 144, 233, 0, 0, 144, 233, 0, 0, 144, 233, 0, 0, 144, 233, 0, 0, 144, 233, 0, 0, 144, 233, 0, 0, 144, 233, 0, 0, 144, 233, 0, 0, 144, 233, 0, 0, 144, 233, 0, 0, 144, 233, 0, 0, 144, 233, 0, 0, 144, 233, 0, 0, 144, 233, 0, 0, 144, 233, 0, 0, 144, 233, 0, 0, 200, 233, 0, 0, 1, 17, 32, 0, 83, 7, 17, 0, 1, 16, 0, 0, 107, 7, 1, 16, 1, 17, 254, 15, 135, 16, 230, 0, 7, 2, 17, 0, 1, 16, 255, 15, 1, 17, 0, 0, 95, 7, 16, 17, 119, 0, 11, 0, 1, 16, 0, 0, 83, 7, 16, 0, 119, 0, 8, 0, 1, 17, 255, 15, 135, 16, 115, 0, 7, 2, 17, 0, 1, 16, 255, 15, 1, 17, 0, 0, 95, 7, 16, 17, 119, 0, 1, 0, 25, 2, 1, 1, 2, 17, 0, 0, 161, 10, 4, 0, 135, 15, 106, 0, 2, 17, 0, 0, 120, 15, 3, 0, 1, 3, 7, 0, 119, 0, 9, 0, 2, 17, 0, 0, 163, 10, 4, 0, 135, 15, 106, 0, 2, 17, 0, 0, 120, 15, 3, 0, 1, 3, 7, 0, 119, 0, 2, 0, 1, 3, 10, 0, 32, 15, 3, 7, 121, 15, 29, 0, 78, 2, 1, 0, 135, 15, 231, 0, 2, 0, 0, 0, 120, 15, 3, 0, 1, 3, 10, 0, 119, 0, 23, 0, 135, 17, 88, 0, 2, 0, 0, 0, 1, 16, 191, 0, 3, 17, 17, 16, 1, 16, 255, 0, 19, 17, 17, 16, 135, 15, 232, 0, 17, 0, 0, 0, 121, 15, 3, 0, 1, 2, 1, 0, 119, 0, 12, 0, 2, 15, 0, 0, 166, 10, 4, 0, 135, 2, 146, 0, 15, 0, 0, 0, 78, 15, 1, 0, 135, 10, 88, 0, 15, 0, 0, 0, 85, 4, 10, 0, 135, 15, 147, 0, 0, 2, 4, 0, 1, 2, 1, 0, 32, 15, 3, 10, 121, 15, 7, 2, 135, 2, 233, 0, 0, 1, 0, 0, 120, 2, 3, 0, 1, 2, 0, 0, 119, 0, 2, 2, 135, 15, 95, 0, 6, 2, 0, 0, 1, 15, 46, 0, 135, 2, 103, 0, 6, 15, 0, 0, 120, 2, 108, 0, 1, 15, 79, 0, 135, 17, 69, 0, 6, 0, 0, 0, 48, 15, 15, 17, 236, 234, 0, 0, 1, 2, 0, 0, 119, 0, 245, 1, 135, 15, 95, 0, 10, 6, 0, 0, 135, 15, 69, 0, 10, 0, 0, 0, 3, 2, 10, 15, 2, 15, 0, 0, 151, 10, 4, 0, 78, 15, 15, 0, 83, 2, 15, 0, 2, 17, 0, 0, 152, 10, 4, 0, 78, 17, 17, 0, 107, 2, 1, 17, 2, 15, 0, 0, 153, 10, 4, 0, 78, 15, 15, 0, 107, 2, 2, 15, 2, 17, 0, 0, 154, 10, 4, 0, 78, 17, 17, 0, 107, 2, 3, 17, 2, 15, 0, 0, 155, 10, 4, 0, 78, 15, 15, 0, 107, 2, 4, 15, 135, 2, 233, 0, 0, 10, 0, 0, 120, 2, 69, 0, 135, 15, 95, 0, 10, 6, 0, 0, 135, 15, 69, 0, 10, 0, 0, 0, 3, 2, 10, 15, 2, 15, 0, 0, 156, 10, 4, 0, 78, 15, 15, 0, 83, 2, 15, 0, 2, 17, 0, 0, 157, 10, 4, 0, 78, 17, 17, 0, 107, 2, 1, 17, 2, 15, 0, 0, 158, 10, 4, 0, 78, 15, 15, 0, 107, 2, 2, 15, 2, 17, 0, 0, 159, 10, 4, 0, 78, 17, 17, 0, 107, 2, 3, 17, 2, 15, 0, 0, 160, 10, 4, 0, 78, 15, 15, 0, 107, 2, 4, 15, 135, 2, 233, 0, 0, 10, 0, 0, 121, 2, 6, 0, 135, 15, 95, 0, 6, 2, 0, 0, 2, 2, 0, 0, 201, 10, 4, 0, 119, 0, 40, 0, 135, 15, 95, 0, 10, 6, 0, 0, 135, 15, 69, 0, 10, 0, 0, 0, 3, 2, 10, 15, 2, 15, 0, 0, 146, 10, 4, 0, 78, 15, 15, 0, 83, 2, 15, 0, 2, 17, 0, 0, 147, 10, 4, 0, 78, 17, 17, 0, 107, 2, 1, 17, 2, 15, 0, 0, 148, 10, 4, 0, 78, 15, 15, 0, 107, 2, 2, 15, 2, 17, 0, 0, 149, 10, 4, 0, 78, 17, 17, 0, 107, 2, 3, 17, 2, 15, 0, 0, 150, 10, 4, 0, 78, 15, 15, 0, 107, 2, 4, 15, 135, 2, 233, 0, 0, 10, 0, 0, 120, 2, 3, 0, 1, 2, 0, 0, 119, 0, 154, 1, 135, 15, 95, 0, 6, 2, 0, 0, 2, 2, 0, 0, 196, 10, 4, 0, 119, 0, 5, 0, 135, 15, 95, 0, 6, 2, 0, 0, 2, 2, 0, 0, 206, 10, 4, 0, 2, 17, 0, 0, 196, 10, 4, 0, 135, 15, 234, 0, 2, 17, 0, 0, 120, 15, 24, 0, 25, 5, 0, 60, 78, 2, 5, 0, 25, 4, 0, 56, 82, 3, 4, 0, 121, 3, 9, 0, 102, 15, 0, 62, 120, 15, 7, 0, 82, 17, 3, 0, 106, 17, 17, 4, 1, 16, 255, 3, 19, 17, 17, 16, 135, 15, 235, 0, 17, 3, 0, 0, 1, 15, 40, 0, 135, 10, 155, 0, 15, 0, 0, 0, 135, 15, 236, 0, 10, 0, 6, 1, 7, 0, 0, 0, 85, 4, 10, 0, 83, 5, 2, 0, 1, 2, 1, 0, 119, 0, 117, 1, 2, 17, 0, 0, 206, 10, 4, 0, 135, 15, 234, 0, 2, 17, 0, 0, 121, 15, 8, 0, 2, 17, 0, 0, 201, 10, 4, 0, 135, 15, 234, 0, 2, 17, 0, 0, 121, 15, 3, 0, 1, 2, 0, 0, 119, 0, 105, 1, 2, 15, 0, 0, 216, 68, 118, 1, 80, 1, 15, 0, 2, 15, 0, 0, 216, 68, 118, 1, 19, 17, 1, 13, 2, 16, 0, 0, 0, 254, 0, 0, 3, 17, 17, 16, 84, 15, 17, 0, 2, 15, 0, 0, 160, 69, 118, 1, 82, 15, 15, 0, 1, 16, 0, 2, 4, 16, 1, 16, 19, 16, 16, 13, 3, 15, 15, 16, 135, 17, 237, 0, 10, 15, 0, 0, 135, 17, 238, 0, 10, 0, 0, 0, 2, 17, 0, 0, 216, 68, 118, 1, 80, 17, 17, 0, 25, 17, 17, 32, 41, 17, 17, 16, 42, 17, 17, 16, 0, 1, 17, 0, 2, 17, 0, 0, 140, 69, 118, 1, 81, 17, 17, 0, 41, 17, 17, 4, 19, 15, 1, 13, 3, 2, 17, 15, 135, 17, 69, 0, 6, 0, 0, 0, 25, 17, 17, 1, 135, 15, 49, 0, 2, 6, 17, 0, 2, 17, 0, 0, 40, 105, 118, 1, 135, 15, 239, 0, 17, 7, 0, 0, 25, 2, 5, 1, 0, 3, 5, 0, 1, 15, 128, 0, 3, 4, 3, 15, 1, 15, 0, 0, 83, 3, 15, 0, 25, 3, 3, 1, 54, 15, 3, 4, 216, 237, 0, 0, 1, 15, 126, 0, 135, 17, 69, 0, 7, 0, 0, 0, 48, 15, 15, 17, 8, 238, 0, 0, 1, 17, 0, 0, 107, 7, 126, 17, 135, 3, 69, 0, 7, 0, 0, 0, 83, 5, 3, 0, 135, 17, 133, 0, 2, 7, 3, 0, 25, 17, 5, 1, 1, 15, 13, 0, 95, 17, 3, 15, 2, 17, 0, 0, 160, 69, 118, 1, 82, 17, 17, 0, 3, 17, 17, 14, 2, 16, 0, 0, 216, 68, 118, 1, 81, 16, 16, 0, 3, 17, 17, 16, 1, 16, 128, 0, 135, 15, 49, 0, 17, 5, 16, 0, 1, 16, 0, 0, 1, 17, 2, 1, 135, 15, 240, 0, 9, 16, 17, 0, 0, 3, 7, 0, 0, 4, 9, 0, 78, 2, 3, 0, 41, 15, 2, 24, 42, 15, 15, 24, 1, 17, 0, 0, 1, 16, 62, 0, 138, 15, 17, 16, 128, 239, 0, 0, 124, 239, 0, 0, 124, 239, 0, 0, 124, 239, 0, 0, 124, 239, 0, 0, 124, 239, 0, 0, 124, 239, 0, 0, 124, 239, 0, 0, 124, 239, 0, 0, 132, 239, 0, 0, 124, 239, 0, 0, 124, 239, 0, 0, 124, 239, 0, 0, 124, 239, 0, 0, 124, 239, 0, 0, 124, 239, 0, 0, 124, 239, 0, 0, 124, 239, 0, 0, 124, 239, 0, 0, 124, 239, 0, 0, 124, 239, 0, 0, 124, 239, 0, 0, 124, 239, 0, 0, 124, 239, 0, 0, 124, 239, 0, 0, 124, 239, 0, 0, 124, 239, 0, 0, 124, 239, 0, 0, 124, 239, 0, 0, 124, 239, 0, 0, 124, 239, 0, 0, 124, 239, 0, 0, 136, 239, 0, 0, 124, 239, 0, 0, 124, 239, 0, 0, 124, 239, 0, 0, 124, 239, 0, 0, 124, 239, 0, 0, 124, 239, 0, 0, 124, 239, 0, 0, 124, 239, 0, 0, 124, 239, 0, 0, 124, 239, 0, 0, 124, 239, 0, 0, 140, 239, 0, 0, 124, 239, 0, 0, 124, 239, 0, 0, 124, 239, 0, 0, 124, 239, 0, 0, 124, 239, 0, 0, 124, 239, 0, 0, 124, 239, 0, 0, 124, 239, 0, 0, 124, 239, 0, 0, 124, 239, 0, 0, 124, 239, 0, 0, 124, 239, 0, 0, 124, 239, 0, 0, 124, 239, 0, 0, 144, 239, 0, 0, 124, 239, 0, 0, 148, 239, 0, 0, 119, 0, 8, 0, 119, 0, 11, 0, 119, 0, 4, 0, 119, 0, 3, 0, 119, 0, 2, 0, 119, 0, 1, 0, 1, 2, 0, 0, 119, 0, 1, 0, 83, 4, 2, 0, 25, 3, 3, 1, 25, 4, 4, 1, 119, 0, 177, 255, 0, 5, 9, 0, 0, 2, 9, 0, 4, 15, 2, 5, 56, 15, 12, 15, 64, 240, 0, 0, 78, 15, 2, 0, 32, 15, 15, 47, 121, 15, 28, 0, 1, 15, 0, 0, 83, 2, 15, 0, 25, 4, 2, 1, 4, 15, 4, 5, 15, 3, 15, 12, 78, 15, 4, 0, 32, 15, 15, 0, 19, 15, 15, 3, 121, 15, 3, 0, 0, 2, 4, 0, 119, 0, 248, 255, 121, 3, 15, 0, 25, 3, 2, 2], eb + 51200);
  HEAPU8.set([4, 7, 3, 5, 25, 17, 2, 3, 4, 16, 12, 7, 135, 15, 101, 0, 17, 3, 16, 0, 47, 15, 7, 12, 44, 240, 0, 0, 1, 15, 0, 0, 83, 3, 15, 0, 0, 2, 3, 0, 119, 0, 4, 0, 0, 2, 3, 0, 119, 0, 2, 0, 0, 2, 4, 0, 25, 2, 2, 1, 119, 0, 222, 255, 1, 15, 1, 1, 1, 16, 0, 0, 95, 9, 15, 16, 1, 15, 0, 0, 95, 9, 14, 15, 1, 15, 255, 0, 1, 16, 0, 0, 95, 9, 15, 16, 1, 3, 0, 0, 19, 16, 3, 13, 0, 2, 16, 0, 19, 16, 3, 13, 56, 16, 14, 16, 148, 240, 0, 0, 90, 16, 9, 2, 120, 16, 6, 0, 25, 16, 3, 1, 41, 16, 16, 16, 42, 16, 16, 16, 0, 3, 16, 0, 119, 0, 245, 255, 2, 17, 0, 0, 136, 72, 118, 1, 135, 15, 0, 0, 17, 0, 0, 0, 1, 17, 92, 0, 1, 18, 1, 0, 3, 19, 9, 2, 135, 16, 42, 0, 15, 17, 18, 19, 8, 0, 0, 0, 79, 16, 8, 0, 3, 16, 16, 2, 19, 16, 16, 13, 0, 2, 16, 0, 19, 16, 2, 13, 90, 16, 9, 16, 120, 16, 2, 0, 119, 0, 6, 0, 25, 16, 2, 1, 41, 16, 16, 16, 42, 16, 16, 16, 0, 2, 16, 0, 119, 0, 248, 255, 19, 16, 2, 13, 0, 3, 16, 0, 19, 16, 2, 13, 56, 16, 14, 16, 32, 241, 0, 0, 90, 16, 9, 3, 120, 16, 6, 0, 25, 16, 2, 1, 41, 16, 16, 16, 42, 16, 16, 16, 0, 2, 16, 0, 119, 0, 245, 255, 2, 18, 0, 0, 136, 72, 118, 1, 135, 19, 0, 0, 18, 0, 0, 0, 1, 18, 108, 0, 1, 17, 1, 0, 3, 15, 9, 3, 135, 16, 42, 0, 19, 18, 17, 15, 8, 0, 0, 0, 2, 15, 0, 0, 136, 72, 118, 1, 135, 16, 0, 0, 15, 0, 0, 0, 19, 16, 16, 13, 41, 16, 16, 16, 39, 16, 16, 92, 0, 9, 16, 0, 25, 2, 10, 10, 84, 2, 9, 0, 43, 15, 9, 16, 108, 2, 2, 15, 2, 16, 0, 0, 136, 72, 118, 1, 135, 15, 0, 0, 16, 0, 0, 0, 19, 15, 15, 13, 41, 15, 15, 16, 39, 15, 15, 108, 0, 2, 15, 0, 25, 9, 10, 14, 84, 9, 2, 0, 43, 16, 2, 16, 108, 9, 2, 16, 2, 16, 0, 0, 140, 69, 118, 1, 81, 16, 16, 0, 41, 16, 16, 16, 2, 15, 0, 0, 216, 68, 118, 1, 80, 15, 15, 0, 3, 15, 15, 14, 19, 15, 15, 13, 20, 16, 16, 15, 0, 9, 16, 0, 25, 2, 10, 6, 84, 2, 9, 0, 43, 15, 9, 16, 108, 2, 2, 15, 135, 15, 241, 0, 10, 0, 0, 0, 2, 15, 0, 0, 200, 68, 118, 1, 1, 16, 0, 75, 84, 15, 16, 0, 2, 16, 0, 0, 140, 69, 118, 1, 80, 10, 16, 0, 2, 16, 0, 0, 142, 69, 118, 1, 84, 16, 10, 0, 19, 16, 10, 13, 41, 16, 16, 4, 0, 2, 16, 0, 2, 16, 0, 0, 164, 69, 118, 1, 85, 16, 2, 0, 2, 16, 0, 0, 208, 68, 118, 1, 84, 16, 1, 0, 2, 16, 0, 0, 136, 69, 118, 1, 84, 16, 10, 0, 2, 16, 0, 0, 152, 69, 118, 1, 85, 16, 2, 0, 2, 16, 0, 0, 212, 68, 118, 1, 2, 15, 0, 0, 216, 68, 118, 1, 80, 15, 15, 0, 84, 16, 15, 0, 2, 15, 0, 0, 236, 68, 118, 1, 2, 16, 0, 0, 236, 68, 118, 1, 82, 16, 16, 0, 1, 17, 255, 253, 19, 16, 16, 17, 85, 15, 16, 0, 1, 15, 33, 0, 134, 16, 0, 0, 28, 73, 1, 0, 15, 0, 0, 0, 2, 16, 0, 0, 216, 68, 118, 1, 2, 15, 0, 0, 216, 68, 118, 1, 81, 15, 15, 0, 1, 17, 0, 2, 3, 15, 15, 17, 84, 16, 15, 0, 1, 2, 1, 0, 137, 11, 0, 0, 139, 2, 0, 0, 140, 0, 13, 0, 0, 0, 0, 0, 136, 7, 0, 0, 0, 4, 7, 0, 136, 7, 0, 0, 1, 8, 160, 0, 3, 7, 7, 8, 137, 7, 0, 0, 25, 5, 4, 12, 25, 3, 4, 8, 0, 0, 4, 0, 25, 2, 4, 16, 25, 1, 4, 24, 2, 8, 0, 0, 89, 3, 4, 0, 2, 9, 0, 0, 247, 232, 3, 0, 135, 7, 242, 0, 8, 9, 0, 0, 2, 9, 0, 0, 95, 5, 4, 0, 2, 8, 0, 0, 6, 233, 3, 0, 135, 7, 242, 0, 9, 8, 0, 0, 2, 8, 0, 0, 253, 5, 4, 0, 2, 9, 0, 0, 126, 233, 3, 0, 135, 7, 242, 0, 8, 9, 0, 0, 2, 9, 0, 0, 15, 6, 4, 0, 2, 8, 0, 0, 139, 233, 3, 0, 135, 7, 242, 0, 9, 8, 0, 0, 2, 8, 0, 0, 170, 3, 4, 0, 2, 9, 0, 0, 153, 233, 3, 0, 135, 7, 242, 0, 8, 9, 0, 0, 2, 9, 0, 0, 128, 7, 4, 0, 2, 8, 0, 0, 174, 233, 3, 0, 135, 7, 242, 0, 9, 8, 0, 0, 2, 8, 0, 0, 209, 8, 4, 0, 2, 9, 0, 0, 203, 233, 3, 0, 135, 7, 242, 0, 8, 9, 0, 0, 2, 9, 0, 0, 136, 8, 4, 0, 2, 8, 0, 0, 229, 233, 3, 0, 135, 7, 242, 0, 9, 8, 0, 0, 2, 8, 0, 0, 163, 8, 4, 0, 2, 9, 0, 0, 27, 234, 3, 0, 135, 7, 242, 0, 8, 9, 0, 0, 2, 9, 0, 0, 186, 8, 4, 0, 2, 8, 0, 0, 113, 234, 3, 0, 135, 7, 242, 0, 9, 8, 0, 0, 2, 8, 0, 0, 136, 255, 3, 0, 2, 9, 0, 0, 185, 234, 3, 0, 135, 7, 242, 0, 8, 9, 0, 0, 2, 9, 0, 0, 221, 6, 4, 0, 2, 8, 0, 0, 225, 234, 3, 0, 135, 7, 242, 0, 9, 8, 0, 0, 2, 8, 0, 0, 242, 6, 4, 0, 2, 9, 0, 0, 5, 235, 3, 0, 135, 7, 242, 0, 8, 9, 0, 0, 2, 9, 0, 0, 6, 7, 4, 0, 2, 8, 0, 0, 28, 235, 3, 0, 135, 7, 242, 0, 9, 8, 0, 0, 2, 8, 0, 0, 64, 7, 4, 0, 2, 9, 0, 0, 43, 235, 3, 0, 135, 7, 242, 0, 8, 9, 0, 0, 2, 9, 0, 0, 25, 7, 4, 0, 2, 8, 0, 0, 78, 235, 3, 0, 135, 7, 242, 0, 9, 8, 0, 0, 2, 8, 0, 0, 181, 6, 4, 0, 2, 9, 0, 0, 84, 235, 3, 0, 135, 7, 242, 0, 8, 9, 0, 0, 2, 9, 0, 0, 75, 1, 4, 0, 2, 8, 0, 0, 90, 236, 3, 0, 135, 7, 242, 0, 9, 8, 0, 0, 2, 8, 0, 0, 55, 2, 4, 0, 2, 9, 0, 0, 119, 236, 3, 0, 135, 7, 242, 0, 8, 9, 0, 0, 2, 9, 0, 0, 14, 2, 4, 0, 2, 8, 0, 0, 134, 236, 3, 0, 135, 7, 242, 0, 9, 8, 0, 0, 2, 8, 0, 0, 92, 4, 4, 0, 2, 9, 0, 0, 220, 236, 3, 0, 135, 7, 242, 0, 8, 9, 0, 0, 2, 9, 0, 0, 191, 3, 4, 0, 2, 8, 0, 0, 241, 236, 3, 0, 135, 7, 242, 0, 9, 8, 0, 0, 2, 8, 0, 0, 161, 6, 4, 0, 2, 9, 0, 0, 8, 237, 3, 0, 135, 7, 242, 0, 8, 9, 0, 0, 2, 9, 0, 0, 227, 1, 4, 0, 2, 8, 0, 0, 31, 237, 3, 0, 135, 7, 242, 0, 9, 8, 0, 0, 2, 8, 0, 0, 243, 2, 4, 0, 2, 9, 0, 0, 72, 237, 3, 0, 135, 7, 242, 0, 8, 9, 0, 0, 2, 9, 0, 0, 9, 3, 4, 0, 2, 8, 0, 0, 110, 237, 3, 0, 135, 7, 242, 0, 9, 8, 0, 0, 2, 8, 0, 0, 24, 5, 4, 0, 2, 9, 0, 0, 146, 237, 3, 0, 135, 7, 242, 0, 8, 9, 0, 0, 2, 9, 0, 0, 195, 4, 4, 0, 2, 8, 0, 0, 175, 237, 3, 0, 135, 7, 242, 0, 9, 8, 0, 0, 2, 8, 0, 0, 234, 4, 4, 0, 2, 9, 0, 0, 207, 237, 3, 0, 135, 7, 242, 0, 8, 9, 0, 0, 2, 9, 0, 0, 162, 5, 4, 0, 2, 8, 0, 0, 239, 237, 3, 0, 135, 7, 242, 0, 9, 8, 0, 0, 2, 8, 0, 0, 191, 5, 4, 0, 2, 9, 0, 0, 19, 238, 3, 0, 135, 7, 242, 0, 8, 9, 0, 0, 2, 9, 0, 0, 245, 1, 4, 0, 2, 8, 0, 0, 46, 238, 3, 0, 135, 7, 242, 0, 9, 8, 0, 0, 2, 8, 0, 0, 66, 238, 3, 0, 2, 9, 0, 0, 88, 238, 3, 0, 135, 7, 242, 0, 8, 9, 0, 0, 2, 9, 0, 0, 20, 9, 4, 0, 2, 8, 0, 0, 113, 238, 3, 0, 135, 7, 242, 0, 9, 8, 0, 0, 2, 8, 0, 0, 142, 9, 4, 0, 2, 9, 0, 0, 131, 238, 3, 0, 135, 7, 242, 0, 8, 9, 0, 0, 2, 9, 0, 0, 167, 9, 4, 0, 2, 8, 0, 0, 156, 238, 3, 0, 135, 7, 242, 0, 9, 8, 0, 0, 2, 8, 0, 0, 166, 10, 4, 0, 2, 9, 0, 0, 186, 238, 3, 0, 135, 7, 242, 0, 8, 9, 0, 0, 2, 9, 0, 0, 173, 254, 3, 0, 2, 8, 0, 0, 60, 239, 3, 0, 135, 7, 242, 0, 9, 8, 0, 0, 2, 8, 0, 0, 246, 3, 4, 0, 2, 9, 0, 0, 82, 239, 3, 0, 135, 7, 242, 0, 8, 9, 0, 0, 2, 9, 0, 0, 148, 0, 4, 0, 2, 8, 0, 0, 110, 239, 3, 0, 135, 7, 242, 0, 9, 8, 0, 0, 2, 8, 0, 0, 163, 7, 4, 0, 2, 9, 0, 0, 146, 239, 3, 0, 135, 7, 242, 0, 8, 9, 0, 0, 2, 9, 0, 0, 186, 7, 4, 0, 2, 8, 0, 0, 166, 239, 3, 0, 135, 7, 242, 0, 9, 8, 0, 0, 2, 8, 0, 0, 189, 239, 3, 0, 2, 9, 0, 0, 215, 239, 3, 0, 135, 7, 242, 0, 8, 9, 0, 0, 2, 9, 0, 0, 252, 239, 3, 0, 2, 8, 0, 0, 20, 240, 3, 0, 135, 7, 242, 0, 9, 8, 0, 0, 2, 8, 0, 0, 43, 231, 3, 0, 2, 9, 0, 0, 164, 240, 3, 0, 135, 7, 242, 0, 8, 9, 0, 0, 2, 9, 0, 0, 63, 231, 3, 0, 2, 8, 0, 0, 180, 243, 3, 0, 135, 7, 242, 0, 9, 8, 0, 0, 2, 8, 0, 0, 81, 231, 3, 0, 2, 9, 0, 0, 239, 244, 3, 0, 135, 7, 242, 0, 8, 9, 0, 0, 2, 9, 0, 0, 136, 245, 3, 0, 2, 8, 0, 0, 156, 245, 3, 0, 135, 7, 242, 0, 9, 8, 0, 0, 2, 8, 0, 0, 100, 231, 3, 0, 2, 9, 0, 0, 63, 246, 3, 0, 135, 7, 242, 0, 8, 9, 0, 0, 2, 9, 0, 0, 118, 231, 3, 0, 2, 8, 0, 0, 50, 247, 3, 0, 135, 7, 242, 0, 9, 8, 0, 0, 2, 8, 0, 0, 232, 254, 3, 0, 2, 9, 0, 0, 89, 247, 3, 0, 135, 7, 242, 0, 8, 9, 0, 0, 2, 9, 0, 0, 95, 8, 4, 0, 2, 8, 0, 0, 130, 247, 3, 0, 135, 7, 242, 0, 9, 8, 0, 0, 2, 8, 0, 0, 87, 255, 3, 0, 2, 9, 0, 0, 144, 248, 3, 0, 135, 7, 242, 0, 8, 9, 0, 0, 2, 9, 0, 0, 207, 254, 3, 0, 2, 8, 0, 0, 159, 248, 3, 0, 135, 7, 242, 0, 9, 8, 0, 0, 2, 8, 0, 0, 196, 255, 3, 0, 2, 9, 0, 0, 176, 248, 3, 0, 135, 7, 242, 0, 8, 9, 0, 0, 2, 9, 0, 0, 221, 255, 3, 0, 2, 8, 0, 0, 230, 248, 3, 0, 135, 7, 242, 0, 9, 8, 0, 0, 2, 8, 0, 0, 15, 0, 4, 0, 2, 9, 0, 0, 252, 248, 3, 0, 135, 7, 242, 0, 8, 9, 0, 0, 2, 9, 0, 0, 98, 0, 4, 0, 2, 8, 0, 0, 8, 249, 3, 0, 135, 7, 242, 0, 9, 8, 0, 0, 2, 8, 0, 0, 59, 4, 4, 0, 2, 9, 0, 0, 25, 249, 3, 0, 135, 7, 242, 0, 8, 9, 0, 0, 2, 9, 0, 0, 175, 0, 4, 0, 2, 8, 0, 0, 65, 249, 3, 0, 135, 7, 242, 0, 9, 8, 0, 0, 2, 8, 0, 0, 137, 3, 4, 0, 2, 9, 0, 0, 84, 249, 3, 0, 135, 7, 242, 0, 8, 9, 0, 0, 2, 9, 0, 0, 3, 1, 4, 0, 2, 8, 0, 0, 124, 249, 3, 0, 135, 7, 242, 0, 9, 8, 0, 0, 2, 8, 0, 0, 38, 0, 4, 0, 2, 9, 0, 0, 155, 249, 3, 0, 135, 7, 242, 0, 8, 9, 0, 0, 2, 9, 0, 0, 246, 255, 3, 0, 2, 8, 0, 0, 207, 249, 3, 0, 135, 7, 242, 0, 9, 8, 0, 0, 2, 8, 0, 0, 22, 1, 4, 0, 2, 9, 0, 0, 250, 249, 3, 0, 135, 7, 242, 0, 8, 9, 0, 0, 2, 9, 0, 0, 100, 1, 4, 0, 2, 8, 0, 0, 47, 250, 3, 0, 135, 7, 242, 0, 9, 8, 0, 0, 2, 8, 0, 0, 196, 1, 4, 0, 2, 9, 0, 0, 85, 250, 3, 0, 135, 7, 242, 0, 8, 9, 0, 0, 2, 9, 0, 0, 203, 0, 4, 0, 2, 8, 0, 0, 116, 250, 3, 0, 135, 7, 242, 0, 9, 8, 0, 0, 2, 8, 0, 0, 108, 3, 4, 0, 2, 9, 0, 0, 147, 250, 3, 0, 135, 7, 242, 0, 8, 9, 0, 0, 2, 9, 0, 0, 71, 3, 4, 0, 2, 8, 0, 0, 162, 250, 3, 0, 135, 7, 242, 0, 9, 8, 0, 0, 2, 8, 0, 0, 229, 0, 4, 0, 2, 9, 0, 0, 226, 250, 3, 0, 135, 7, 242, 0, 8, 9, 0, 0, 2, 9, 0, 0, 36, 3, 4, 0, 2, 8, 0, 0, 254, 250, 3, 0, 135, 7, 242, 0, 9, 8, 0, 0, 2, 8, 0, 0, 156, 255, 3, 0, 2, 9, 0, 0, 158, 251, 3, 0, 135, 7, 242, 0, 8, 9, 0, 0, 2, 9, 0, 0, 111, 255, 3, 0, 2, 8, 0, 0, 186, 251, 3, 0, 135, 7, 242, 0, 9, 8, 0, 0, 2, 8, 0, 0, 31, 255, 3, 0, 2, 9, 0, 0, 199, 251, 3, 0, 135, 7, 242, 0, 8, 9, 0, 0, 2, 9, 0, 0, 49, 1, 4, 0, 2, 8, 0, 0, 251, 251, 3, 0, 135, 7, 242, 0, 9, 8, 0, 0, 2, 8, 0, 0, 65, 0, 4, 0, 2, 9, 0, 0, 37, 252, 3, 0, 135, 7, 242, 0, 8, 9, 0, 0, 2, 9, 0, 0, 61, 255, 3, 0, 2, 8, 0, 0, 102, 252, 3, 0, 135, 7, 242, 0, 9, 8, 0, 0, 2, 8, 0, 0, 238, 7, 4, 0, 2, 9, 0, 0, 145, 252, 3, 0, 135, 7, 242, 0, 8, 9, 0, 0, 2, 9, 0, 0, 4, 255, 3, 0, 2, 8, 0, 0, 141, 253, 3, 0, 135, 7, 242, 0, 9, 8, 0, 0, 2, 8, 0, 0, 122, 0, 4, 0, 2, 9, 0, 0, 184, 253, 3, 0, 135, 7, 242, 0, 8, 9, 0, 0, 2, 9, 0, 0, 124, 1, 4, 0, 2, 8, 0, 0, 213, 253, 3, 0, 135, 7, 242, 0, 9, 8, 0, 0, 2, 8, 0, 0, 178, 1, 4, 0, 2, 9, 0, 0, 253, 253, 3, 0, 135, 7, 242, 0, 8, 9, 0, 0, 135, 6, 243, 0, 2, 7, 0, 0, 138, 69, 118, 1, 1, 9, 0, 240, 84, 7, 9, 0, 2, 9, 0, 0, 156, 69, 118, 1, 2, 7, 0, 0, 0, 0, 15, 0, 85, 9, 7, 0, 2, 7, 0, 0, 232, 68, 118, 1, 41, 9, 6, 5, 1, 8, 0, 16, 3, 9, 9, 8, 84, 7, 9, 0, 1, 7, 200, 0, 1, 8, 3, 0, 2, 10, 0, 0, 47, 254, 3, 0, 135, 9, 244, 0, 6, 7, 8, 10, 2, 10, 0, 0, 58, 254, 3, 0, 1, 8, 53, 3, 135, 9, 245, 0, 10, 8, 0, 0, 1, 9, 128, 0, 135, 6, 246, 0, 9, 0, 0, 0, 2, 9, 0, 0, 140, 69, 118, 1, 84, 9, 6, 0, 2, 9, 0, 0, 160, 69, 118, 1, 2, 8, 0, 0, 255, 255, 0, 0, 19, 8, 6, 8, 41, 8, 8, 4, 85, 9, 8, 0, 2, 8, 0, 0, 216, 68, 118, 1, 1, 9, 254, 7, 84, 8, 9, 0, 1, 8, 144, 18, 1, 10, 234, 255, 135, 9, 16, 0, 8, 10, 0, 0, 1, 10, 145, 18, 1, 7, 144, 0, 135, 8, 44, 0, 7, 0, 0, 0, 135, 9, 38, 0, 10, 8, 0, 0, 1, 8, 144, 0, 2, 10, 0, 0, 16, 1, 24, 1, 135, 9, 38, 0, 8, 10, 0, 0, 1, 10, 140, 0, 2, 8, 0, 0, 0, 0, 24, 1, 135, 9, 38, 0, 10, 8, 0, 0, 135, 8, 243, 0, 1, 10, 201, 0, 1, 7, 5, 0, 1, 11, 152, 18, 2, 12, 0, 0, 70, 254, 3, 0, 135, 9, 247, 0, 8, 10, 7, 11, 12, 0, 0, 0, 1, 12, 184, 0, 2, 11, 0, 0, 8, 0, 41, 1, 135, 9, 38, 0, 12, 11, 0, 0, 1, 11, 23, 1, 135, 9, 248, 0, 5, 11, 0, 0, 1, 11, 24, 1, 135, 9, 249, 0, 5, 11, 0, 0, 1, 11, 18, 0, 135, 9, 250, 0, 5, 11, 0, 0, 1, 11, 77, 0, 135, 9, 251, 0, 5, 11, 0, 0, 1, 11, 42, 1, 135, 9, 248, 0, 3, 11, 0, 0, 1, 11, 24, 1, 135, 9, 249, 0, 3, 11, 0, 0, 1, 11, 68, 0, 135, 9, 250, 0, 3, 11, 0, 0, 1, 11, 77, 0, 135, 9, 251, 0, 3, 11, 0, 0, 1, 11, 176, 18, 2, 12, 0, 0, 83, 254, 3, 0, 1, 7, 9, 0, 135, 9, 49, 0, 11, 12, 7, 0, 1, 7, 185, 18, 2, 12, 0, 0, 92, 254, 3, 0, 1, 11, 23, 0, 135, 9, 49, 0, 7, 12, 11, 0, 1, 11, 208, 18, 1, 12, 0, 0, 135, 9, 16, 0, 11, 12, 0, 0, 1, 12, 209, 18, 1, 11, 1, 0, 135, 9, 87, 0, 12, 11, 0, 0, 1, 11, 211, 18, 2, 12, 0, 0, 115, 254, 3, 0, 1, 7, 15, 0, 135, 9, 49, 0, 11, 12, 7, 0, 1, 7, 24, 1, 135, 9, 1, 0, 0, 7, 0, 0, 1, 7, 0, 0, 135, 9, 252, 0, 0, 7, 0, 0, 2, 7, 0, 0, 136, 72, 118, 1, 1, 12, 24, 1, 135, 9, 75, 0, 7, 12, 0, 0, 1, 9, 0, 0, 84, 2, 9, 0, 2, 12, 0, 0, 130, 254, 3, 0, 1, 7, 2, 0, 1, 11, 0, 0, 135, 9, 56, 0, 12, 7, 2, 11, 2, 11, 0, 0, 130, 254, 3, 0, 1, 7, 2, 0, 1, 12, 0, 0, 135, 9, 56, 0, 11, 7, 2, 12, 1, 12, 0, 0, 1, 7, 0, 0, 135, 9, 57, 0, 12, 7, 0, 0, 1, 7, 1, 0, 1, 12, 0, 0, 135, 9, 67, 0, 7, 12, 0, 0, 1, 12, 1, 0, 1, 7, 2, 0, 135, 9, 67, 0, 12, 7, 0, 0, 2, 7, 0, 0, 130, 254, 3, 0, 1, 12, 2, 0, 1, 11, 0, 0, 135, 9, 56, 0, 7, 12, 2, 11, 2, 11, 0, 0, 134, 254, 3, 0, 1, 12, 2, 0, 1, 7, 0, 0, 135, 9, 56, 0, 11, 12, 2, 7, 1, 7, 24, 1, 135, 9, 253, 0, 0, 7, 0, 0, 1, 7, 43, 1, 135, 9, 254, 0, 0, 7, 0, 0, 1, 9, 18, 0, 83, 1, 9, 0, 25, 0, 1, 1, 25, 2, 1, 20, 25, 3, 2, 108, 1, 9, 0, 0, 83, 2, 9, 0, 25, 2, 2, 1, 54, 9, 2, 3, 176, 253, 0, 0, 0, 2, 0, 0, 2, 0, 0, 0, 138, 254, 3, 0, 25, 3, 2, 19, 78, 9, 0, 0, 83, 2, 9, 0, 25, 2, 2, 1, 25, 0, 0, 1, 54, 9, 2, 3, 212, 253, 0, 0, 1, 7, 0, 18, 1, 12, 128, 0, 135, 9, 49, 0, 7, 1, 12, 0, 2, 12, 0, 0, 136, 72, 118, 1, 2, 7, 0, 0, 128, 0, 24, 1, 135, 9, 31, 0, 12, 7, 0, 0, 2, 7, 0, 0, 136, 72, 118, 1, 1, 12, 24, 1, 135, 9, 75, 0, 7, 12, 0, 0, 2, 12, 0, 0, 32, 105, 118, 1, 135, 9, 255, 0, 12, 0, 0, 0, 2, 9, 0, 0, 32, 105, 118, 1, 82, 0, 9, 0, 82, 12, 0, 0, 106, 12, 12, 8, 1, 7, 255, 3, 19, 12, 12, 7, 135, 9, 235, 0, 12, 0, 0, 0, 2, 9, 0, 0, 32, 105, 118, 1, 82, 0, 9, 0, 121, 0, 7, 0, 82, 12, 0, 0, 106, 12, 12, 4, 1, 7, 255, 3, 19, 12, 12, 7, 135, 9, 235, 0, 12, 0, 0, 0, 2, 9, 0, 0, 32, 105, 118, 1, 1, 12, 0, 0, 85, 9, 12, 0, 137, 4, 0, 0, 139, 0, 0, 0, 140, 1, 23, 0, 0, 0, 0, 0, 2, 18, 0, 0, 255, 255, 0, 0, 1, 9, 0, 0, 136, 19, 0, 0, 0, 16, 19, 0, 136, 19, 0, 0, 1, 20, 176, 0, 3, 19, 19, 20, 137, 19, 0, 0, 25, 5, 16, 48, 25, 14, 16, 32, 25, 13, 16, 24, 25, 6, 16, 16, 25, 3, 16, 8, 1, 19, 160, 0, 3, 11, 16, 19, 1, 19, 148, 0, 3, 12, 16, 19, 25, 4, 16, 56, 1, 19, 174, 0, 3, 10, 16, 19, 1, 19, 172, 0, 3, 15, 16, 19, 2, 20, 0, 0, 0, 63, 52, 0, 82, 20, 20, 0, 135, 19, 145, 0, 20, 0, 0, 0, 121, 19, 8, 0, 2, 21, 0, 0, 41, 62, 4, 0, 135, 20, 146, 0, 21, 0, 0, 0, 135, 19, 147, 0, 0, 20, 16, 0, 119, 0, 15, 1, 135, 19, 144, 0, 0, 0, 0, 0, 1, 19, 0, 0, 85, 11, 19, 0, 1, 20, 0, 0, 109, 11, 4, 20, 1, 19, 0, 0, 109, 11, 8, 19, 1, 1, 0, 0, 32, 19, 1, 3, 120, 19, 6, 0, 41, 19, 1, 2, 1, 20, 0, 0, 97, 11, 19, 20, 25, 1, 1, 1, 119, 0, 250, 255, 1, 20, 0, 0, 85, 12, 20, 0, 1, 19, 0, 0, 109, 12, 4, 19, 1, 20, 0, 0, 109, 12, 8, 20, 1, 1, 0, 0, 32, 20, 1, 3, 120, 20, 6, 0, 41, 20, 1, 2, 1, 19, 0, 0, 97, 12, 20, 19, 25, 1, 1, 1, 119, 0, 250, 255, 25, 2, 0, 16, 82, 19, 2, 0, 2, 20, 0, 0, 181, 172, 3, 0, 1, 21, 1, 0, 135, 1, 188, 0, 19, 20, 11, 21, 82, 20, 2, 0, 135, 21, 148, 0, 20, 0, 0, 0, 32, 21, 21, 1, 121, 21, 216, 0, 82, 20, 2, 0, 1, 19, 1, 0, 135, 21, 150, 0, 20, 19, 12, 0, 121, 21, 209, 0, 120, 1, 35, 0, 1, 21, 47, 0, 1, 19, 255, 255, 135, 1, 0, 1, 12, 21, 19, 0, 32, 19, 1, 255, 121, 19, 4, 0, 135, 19, 151, 0, 11, 12, 0, 0, 119, 0, 10, 0, 25, 21, 1, 1, 1, 20, 255, 255, 135, 19, 223, 0, 4, 12, 21, 20, 12, 0, 0, 0, 135, 19, 151, 0, 11, 4, 0, 0, 135, 19, 99, 0, 4, 0, 0, 0, 102, 8, 11, 11, 41, 20, 8, 24, 42, 20, 20, 24, 34, 20, 20, 0, 121, 20, 4, 0, 106, 20, 11, 4, 0, 19, 20, 0, 119, 0, 4, 0, 1, 20, 255, 0, 19, 20, 8, 20, 0, 19, 20, 0, 120, 19, 5, 0, 2, 20, 0, 0, 206, 172, 3, 0, 135, 19, 239, 0, 11, 20, 0, 0, 135, 19, 1, 1, 4, 0, 0, 0, 2, 19, 0, 0, 71, 69, 84, 0, 85, 4, 19, 0, 1, 20, 1, 0, 109, 4, 52, 20, 1, 19, 39, 3, 109, 4, 36, 19, 1, 20, 40, 3, 109, 4, 40, 20, 2, 20, 0, 0, 124, 46, 203, 1, 1, 19, 0, 0, 83, 20, 19, 0, 25, 1, 12, 11, 78, 20, 1, 0, 34, 20, 20, 0, 121, 20, 4, 0, 82, 20, 12, 0, 0, 19, 20, 0, 119, 0, 2, 0, 0, 19, 12, 0, 135, 8, 2, 1, 4, 19, 0, 0, 2, 19, 0, 0, 124, 46, 203, 1, 78, 19, 19, 0, 120, 19, 5, 0, 1, 20, 10, 0, 135, 19, 137, 0, 20, 0, 0, 0, 119, 0, 249, 255, 2, 19, 0, 0, 123, 46, 203, 1, 78, 19, 19, 0, 120, 19, 18, 0, 2, 19, 0, 0, 31, 173, 3, 0, 135, 15, 146, 0, 19, 0, 0, 0, 105, 14, 8, 42, 78, 20, 1, 0, 34, 20, 20, 0, 121, 20, 4, 0, 82, 20, 12, 0, 0, 19, 20, 0, 119, 0, 2, 0, 0, 19, 12, 0, 85, 5, 19, 0, 109, 5, 4, 14, 135, 19, 147, 0, 0, 15, 5, 0, 119, 0, 117, 0, 25, 7, 11, 11, 78, 21, 7, 0, 34, 21, 21, 0, 121, 21, 4, 0, 82, 21, 11, 0, 0, 20, 21, 0, 119, 0, 2, 0, 0, 20, 11, 0, 1, 21, 1, 0, 1, 22, 0, 0, 135, 19, 55, 0, 20, 21, 10, 22, 121, 19, 90, 0, 25, 6, 8, 16, 0, 2, 6, 0, 82, 1, 2, 0, 106, 2, 2, 4, 106, 5, 8, 12, 32, 19, 1, 0, 32, 22, 2, 0, 19, 19, 19, 22, 121, 19, 3, 0, 1, 9, 29, 0, 119, 0, 33, 0, 35, 19, 2, 0, 32, 22, 2, 0, 16, 21, 1, 18, 19, 22, 22, 21, 20, 19, 19, 22, 0, 3, 19, 0, 125, 4, 3, 1, 18, 0, 0, 0, 19, 19, 4, 18, 0, 9, 19, 0, 84, 15, 9, 0, 80, 19, 10, 0, 1, 22, 0, 0, 135, 17, 7, 0, 19, 5, 15, 22, 80, 22, 15, 0, 41, 19, 9, 16, 42, 19, 19, 16, 13, 22, 22, 19, 19, 22, 17, 22, 120, 22, 3, 0, 1, 9, 27, 0, 119, 0, 10, 0, 1, 19, 0, 0, 125, 22, 3, 2, 19, 0, 0, 0, 135, 17, 3, 1, 1, 2, 4, 22, 0, 1, 17, 0, 135, 2, 4, 1, 3, 5, 5, 4, 119, 0, 219, 255, 32, 22, 9, 27, 121, 22, 16, 0, 2, 22, 0, 0, 240, 172, 3, 0, 135, 17, 146, 0, 22, 0, 0, 0, 78, 19, 7, 0, 34, 19, 19, 0, 121, 19, 4, 0, 82, 19, 11, 0, 0, 22, 19, 0, 119, 0, 2, 0, 0, 22, 11, 0, 85, 13, 22, 0, 135, 22, 147, 0, 0, 17, 13, 0, 119, 0, 25, 0, 32, 22, 9, 29, 121, 22, 23, 0, 2, 22, 0, 0, 7, 173, 3, 0, 135, 17, 146, 0, 22, 0, 0, 0, 0, 5, 6, 0, 106, 6, 5, 4, 106, 13, 8, 8, 78, 19, 7, 0, 34, 19, 19, 0, 121, 19, 4, 0, 82, 19, 11, 0, 0, 22, 19, 0, 119, 0, 2, 0, 0, 22, 11, 0, 0, 15, 22, 0, 0, 7, 14, 0, 116, 7, 5, 0, 109, 7, 4, 6, 109, 14, 8, 13, 109, 14, 12, 15, 135, 22, 147, 0, 0, 17, 14, 0, 80, 19, 10, 0, 1, 21, 0, 0, 135, 22, 57, 0, 19, 21, 0, 0, 119, 0, 15, 0, 2, 22, 0, 0, 216, 172, 3, 0, 135, 17, 146, 0, 22, 0, 0, 0, 78, 21, 7, 0, 34, 21, 21, 0, 121, 21, 4, 0, 82, 21, 11, 0, 0, 22, 21, 0, 119, 0, 2, 0, 0, 22, 11, 0, 85, 6, 22, 0, 135, 22, 147, 0, 0, 17, 6, 0, 135, 22, 5, 1, 8, 0, 0, 0, 119, 0, 4, 0, 1, 9, 11, 0, 119, 0, 2, 0, 1, 9, 11, 0, 32, 22, 9, 11, 121, 22, 7, 0, 2, 19, 0, 0, 184, 172, 3, 0, 135, 21, 146, 0, 19, 0, 0, 0, 135, 22, 147, 0, 0, 21, 3, 0, 135, 22, 99, 0, 12, 0, 0, 0, 135, 22, 99, 0, 11, 0, 0, 0, 137, 16, 0, 0, 139, 0, 0, 0, 140, 1, 24, 0, 0, 0, 0, 0, 2, 18, 0, 0, 216, 171, 3, 0, 2, 19, 0, 0, 100, 36, 187, 0, 136, 20, 0, 0, 0, 17, 20, 0, 136, 20, 0, 0, 1, 21, 112, 1, 3, 20, 20, 21, 137, 20, 0, 0, 1, 20, 72, 1, 3, 4, 17, 20, 1, 20, 64, 1, 3, 3, 17, 20, 1, 20, 56, 1, 3, 12, 17, 20, 1, 20, 48, 1, 3, 11, 17, 20, 1, 20, 40, 1, 3, 10, 17, 20, 1, 20, 32, 1, 3, 15, 17, 20, 1, 20, 24, 1, 3, 14, 17, 20, 1, 20, 16, 1, 3, 13, 17, 20, 1, 20, 8, 1, 3, 9, 17, 20, 1, 20, 0, 1, 3, 2, 17, 20, 1, 20, 84, 1, 3, 16, 17, 20, 1, 20, 80, 1, 3, 8, 17, 20, 0, 6, 17, 0, 1, 20, 96, 1, 3, 7, 17, 20, 25, 5, 0, 16, 25, 1, 0, 4, 82, 21, 5, 0, 1, 22, 1, 0, 135, 20, 150, 0, 21, 22, 1, 0, 121, 20, 195, 0, 82, 22, 5, 0, 2, 21, 0, 0, 143, 1, 4, 0, 1, 23, 0, 0, 135, 20, 188, 0, 22, 21, 1, 23, 121, 20, 6, 0, 135, 23, 146, 0, 18, 0, 0, 0, 135, 20, 147, 0, 0, 23, 2, 0, 119, 0, 208, 0, 1, 20, 0, 0, 85, 16, 20, 0, 1, 23, 0, 0, 109, 16, 4, 23, 1, 20, 0, 0, 109, 16, 8, 20, 1, 2, 0, 0, 32, 20, 2, 3, 120, 20, 6, 0, 41, 20, 2, 2, 1, 23, 0, 0, 97, 16, 20, 23, 25, 2, 2, 1, 119, 0, 250, 255, 1, 23, 255, 255, 85, 8, 23, 0, 82, 20, 5, 0, 1, 21, 2, 0, 135, 23, 150, 0, 20, 21, 16, 0, 121, 23, 58, 0, 25, 2, 16, 11, 78, 21, 2, 0, 34, 21, 21, 0, 121, 21, 4, 0, 82, 21, 16, 0, 0, 23, 21, 0, 119, 0, 2, 0, 0, 23, 16, 0, 135, 4, 118, 0, 23, 0, 0, 0, 85, 8, 4, 0, 82, 21, 5, 0, 1, 20, 3, 0, 135, 23, 150, 0, 21, 20, 16, 0, 121, 23, 11, 0, 78, 21, 2, 0, 34, 21, 21, 0, 121, 21, 4, 0, 82, 21, 16, 0, 0, 20, 21, 0, 119, 0, 2, 0, 0, 20, 16, 0, 135, 23, 95, 0, 6, 20, 0, 0, 119, 0, 21, 0, 2, 23, 0, 0, 116, 106, 4, 0, 78, 23, 23, 0, 83, 6, 23, 0, 2, 20, 0, 0, 117, 106, 4, 0, 78, 20, 20, 0, 107, 6, 1, 20, 2, 23, 0, 0, 118, 106, 4, 0, 78, 23, 23, 0, 107, 6, 2, 23, 2, 20, 0, 0, 119, 106, 4, 0, 78, 20, 20, 0, 107, 6, 3, 20, 2, 23, 0, 0, 120, 106, 4, 0, 78, 23, 23, 0, 107, 6, 4, 23, 102, 23, 1, 11, 34, 23, 23, 0, 121, 23, 3, 0, 82, 2, 1, 0, 119, 0, 2, 0, 0, 2, 1, 0, 82, 23, 8, 0, 134, 2, 0, 0, 204, 71, 1, 0, 2, 23, 6, 0, 119, 0, 10, 0, 102, 23, 1, 11, 34, 23, 23, 0, 121, 23, 3, 0, 82, 2, 1, 0, 119, 0, 2, 0, 0, 2, 1, 0, 134, 2, 0, 0, 64, 71, 1, 0, 2, 8, 0, 0, 1, 23, 0, 0, 1, 20, 5, 0, 138, 2, 23, 20, 0, 6, 1, 0, 64, 6, 1, 0, 128, 6, 1, 0, 176, 6, 1, 0, 232, 6, 1, 0, 1, 20, 14, 0, 1, 21, 2, 0, 135, 23, 3, 0, 7, 20, 21, 0, 2, 21, 0, 0, 105, 172, 3, 0, 77, 20, 2, 0, 135, 23, 21, 0, 7, 21, 20, 0, 119, 0, 75, 0, 2, 23, 0, 0, 238, 171, 3, 0, 135, 2, 146, 0, 23, 0, 0, 0, 102, 23, 1, 11, 34, 23, 23, 0, 121, 23, 2, 0, 82, 1, 1, 0, 2, 23, 0, 0, 200, 72, 118, 1, 81, 15, 23, 0, 85, 9, 1, 0, 109, 9, 4, 15, 135, 23, 147, 0, 0, 2, 9, 0, 119, 0, 59, 0, 2, 23, 0, 0, 3, 172, 3, 0, 135, 2, 146, 0, 23, 0, 0, 0, 102, 23, 1, 11, 34, 23, 23, 0, 121, 23, 2, 0, 82, 1, 1, 0, 85, 13, 1, 0, 135, 23, 147, 0, 0, 2, 13, 0, 135, 20, 146, 0, 18, 0, 0, 0, 135, 23, 147, 0, 0, 20, 14, 0, 119, 0, 43, 0, 2, 23, 0, 0, 29, 172, 3, 0, 135, 2, 146, 0, 23, 0, 0, 0, 102, 23, 1, 11, 34, 23, 23, 0, 121, 23, 2, 0, 82, 1, 1, 0, 85, 15, 1, 0, 135, 23, 147, 0, 0, 2, 15, 0, 119, 0, 31, 0, 2, 23, 0, 0, 54, 172, 3, 0, 135, 2, 146, 0, 23, 0, 0, 0, 102, 23, 1, 11, 34, 23, 23, 0, 121, 23, 2, 0, 82, 1, 1, 0, 82, 15, 8, 0, 85, 10, 1, 0, 109, 10, 4, 15, 135, 23, 147, 0, 0, 2, 10, 0, 119, 0, 17, 0, 2, 23, 0, 0, 82, 172, 3, 0, 135, 2, 146, 0, 23, 0, 0, 0, 102, 23, 1, 11, 34, 23, 23, 0, 121, 23, 2, 0, 82, 1, 1, 0, 85, 11, 1, 0, 135, 23, 147, 0, 0, 2, 11, 0, 135, 20, 146, 0, 18, 0, 0, 0, 135, 23, 147, 0, 0, 20, 12, 0, 119, 0, 1, 0, 135, 23, 99, 0, 16, 0, 0, 0, 119, 0, 26, 0, 135, 1, 6, 1, 120, 1, 12, 0, 2, 23, 0, 0, 132, 172, 3, 0, 135, 16, 146, 0, 23, 0, 0, 0, 2, 23, 0, 0, 200, 72, 118, 1, 81, 23, 23, 0, 85, 3, 23, 0, 135, 23, 147, 0, 0, 16, 3, 0, 119, 0, 13, 0, 2, 23, 0, 0, 150, 172, 3, 0, 135, 16, 146, 0, 23, 0, 0, 0, 2, 23, 0, 0, 200, 72, 118, 1, 81, 23, 23, 0, 85, 4, 23, 0, 109, 4, 4, 1, 135, 23, 147, 0, 0, 16, 4, 0, 119, 0, 1, 0, 137, 17, 0, 0, 139, 0, 0, 0, 140, 2, 24, 0, 0, 0, 0, 0, 2, 18, 0, 0, 200, 68, 118, 1, 2, 19, 0, 0, 54, 7, 4, 0, 2, 20, 0, 0, 102, 34, 187, 0, 136, 21, 0, 0, 0, 17, 21, 0, 136, 21, 0, 0, 1, 22, 144, 0, 3, 21, 21, 22, 137, 21, 0, 0, 25, 16, 17, 112, 25, 15, 17, 104, 25, 14, 17, 96, 25, 13, 17, 88, 25, 12, 17, 80, 25, 9, 17, 72, 25, 11, 17, 56, 25, 5, 17, 48, 25, 8, 17, 32, 25, 7, 17, 24, 25, 6, 17, 16, 25, 2, 17, 124, 25, 3, 17, 120, 25, 4, 17, 116, 1, 21, 128, 0, 3, 10, 17, 21, 2, 22, 0, 0, 143, 1, 4, 0, 135, 21, 171, 0, 1, 22, 0, 0, 121, 21, 29, 0, 2, 23, 0, 0, 136, 255, 3, 0, 135, 22, 146, 0, 23, 0, 0, 0, 135, 21, 147, 0, 0, 22, 17, 0, 2, 21, 0, 0, 181, 6, 4, 0, 135, 2, 146, 0, 21, 0, 0, 0, 2, 22, 0, 0, 164, 72, 4, 0, 25, 23, 17, 8, 135, 21, 147, 0, 0, 22, 23, 0, 2, 23, 0, 0, 140, 73, 4, 0, 135, 21, 106, 0, 23, 2, 0, 0, 120, 21, 6, 0, 2, 23, 0, 0, 206, 6, 4, 0, 135, 21, 147, 0, 0, 23, 7, 0, 119, 0, 223, 0, 135, 21, 147, 0, 0, 2, 6, 0, 119, 0, 220, 0, 2, 23, 0, 0, 122, 21, 4, 0, 135, 21, 171, 0, 1, 23, 0, 0, 121, 21, 31, 0, 1, 21, 0, 0, 135, 0, 7, 1, 21, 0, 0, 0, 85, 2, 0, 0, 135, 0, 8, 1, 2, 0, 0, 0, 2, 21, 0, 0, 204, 68, 118, 1, 106, 23, 0, 20, 1, 22, 108, 7, 3, 23, 23, 22, 84, 21, 23, 0, 2, 23, 0, 0, 209, 68, 118, 1, 106, 21, 0, 16, 25, 21, 21, 1, 83, 23, 21, 0, 2, 21, 0, 0, 208, 68, 118, 1, 106, 23, 0, 12, 83, 21, 23, 0, 2, 23, 0, 0, 201, 68, 118, 1, 1, 21, 43, 0, 83, 23, 21, 0, 1, 23, 33, 0, 134, 21, 0, 0, 28, 73, 1, 0, 23, 0, 0, 0, 119, 0, 185, 0, 85, 8, 3, 0, 109, 8, 4, 2, 109, 8, 8, 4, 2, 23, 0, 0, 212, 6, 4, 0, 135, 21, 9, 1, 1, 23, 8, 0, 32, 21, 21, 3, 121, 21, 31, 0, 2, 21, 0, 0, 204, 68, 118, 1, 82, 23, 4, 0, 84, 21, 23, 0, 2, 23, 0, 0, 209, 68, 118, 1, 82, 21, 3, 0, 83, 23, 21, 0, 2, 21, 0, 0, 208, 68, 118, 1, 82, 23, 2, 0, 83, 21, 23, 0, 2, 23, 0, 0, 201, 68, 118, 1, 1, 21, 43, 0, 83, 23, 21, 0, 1, 23, 33, 0, 134, 21, 0, 0, 28, 73, 1, 0, 23, 0, 0, 0, 78, 21, 18, 0, 32, 21, 21, 255, 121, 21, 153, 0, 2, 22, 0, 0, 221, 6, 4, 0, 135, 23, 146, 0, 22, 0, 0, 0, 135, 21, 147, 0, 0, 23, 5, 0, 119, 0, 146, 0, 2, 21, 0, 0, 201, 68, 118, 1, 1, 23, 42, 0, 83, 21, 23, 0, 1, 21, 33, 0, 134, 23, 0, 0, 28, 73, 1, 0, 21, 0, 0, 0, 2, 23, 0, 0, 242, 6, 4, 0, 135, 4, 146, 0, 23, 0, 0, 0, 1, 23, 0, 0, 83, 10, 23, 0, 1, 21, 0, 0, 107, 10, 1, 21, 1, 23, 0, 0, 107, 10, 2, 23, 1, 21, 0, 0, 107, 10, 3, 21, 1, 23, 0, 0, 107, 10, 4, 23, 1, 21, 0, 0, 107, 10, 5, 21, 85, 11, 8, 0, 2, 23, 0, 0, 151, 72, 4, 0, 135, 21, 9, 1, 4, 23, 11, 0, 33, 7, 21, 0, 82, 2, 8, 0, 35, 21, 2, 5, 19, 21, 7, 21, 121, 21, 19, 0, 135, 21, 69, 0, 4, 0, 0, 0, 27, 23, 2, 7, 25, 23, 23, 1, 45, 21, 21, 23, 148, 10, 1, 0, 1, 3, 0, 0, 52, 21, 3, 2, 148, 10, 1, 0, 25, 8, 3, 1, 79, 23, 18, 0, 5, 21, 2, 23, 3, 21, 8, 21, 3, 7, 4, 21, 78, 23, 7, 0, 95, 10, 3, 23, 0, 3, 8, 0, 119, 0, 246, 255, 2, 23, 0, 0, 145, 21, 4, 0, 135, 7, 171, 0, 1, 23, 0, 0, 120, 7, 7, 0, 2, 22, 0, 0, 6, 7, 4, 0, 135, 21, 146, 0, 22, 0, 0, 0, 135, 23, 147, 0, 0, 21, 9, 0, 2, 23, 0, 0, 25, 7, 4, 0, 135, 6, 146, 0, 23, 0, 0, 0, 135, 23, 69, 0, 6, 0, 0, 0, 32, 23, 23, 5, 121, 23, 75, 0, 0, 2, 11, 0, 25, 3, 2, 15, 1, 23, 0, 0, 83, 2, 23, 0, 25, 2, 2, 1, 54, 23, 2, 3, 232, 10, 1, 0, 1, 2, 0, 0, 1, 5, 0, 0, 32, 23, 5, 5, 120, 23, 51, 0, 3, 4, 6, 5, 78, 3, 4, 0, 39, 23, 5, 2, 32, 23, 23, 3, 121, 23, 4, 0, 95, 11, 2, 3, 25, 2, 2, 1, 119, 0, 41, 0, 41, 23, 3, 24, 42, 23, 23, 24, 32, 23, 23, 77, 121, 23, 10, 0, 2, 23, 0, 0, 209, 68, 118, 1, 79, 23, 23, 0, 85, 13, 23, 0, 3, 21, 11, 2, 135, 23, 10, 1, 21, 19, 13, 0, 3, 2, 23, 2, 78, 3, 4, 0, 41, 23, 3, 24, 42, 23, 23, 24, 32, 23, 23, 68, 121, 23, 10, 0, 2, 23, 0, 0, 208, 68, 118, 1, 79, 23, 23, 0, 85, 14, 23, 0, 3, 21, 11, 2, 135, 23, 10, 1, 21, 19, 14, 0, 3, 2, 23, 2, 78, 3, 4, 0, 41, 23, 3, 24, 42, 23, 23, 24, 32, 23, 23, 89, 121, 23, 11, 0, 2, 23, 0, 0, 204, 68, 118, 1, 81, 23, 23, 0, 85, 15, 23, 0, 3, 21, 11, 2, 2, 22, 0, 0, 59, 7, 4, 0, 135, 23, 10, 1, 21, 22, 15, 0, 3, 2, 23, 2, 25, 5, 5, 1, 119, 0, 205, 255, 85, 12, 10, 0, 109, 12, 4, 11, 2, 22, 0, 0, 47, 7, 4, 0, 135, 23, 147, 0, 0, 22, 12, 0, 120, 7, 7, 0, 2, 21, 0, 0, 64, 7, 4, 0, 135, 22, 146, 0, 21, 0, 0, 0, 135, 23, 147, 0, 0, 22, 16, 0, 137, 17, 0, 0, 139, 0, 0, 0, 140, 2, 24, 0, 0, 0, 0, 0, 2, 19, 0, 0, 255, 0, 0, 0, 2, 20, 0, 0, 25, 8, 4, 0, 1, 7, 0, 0, 136, 21, 0, 0, 0, 18, 21, 0, 136, 21, 0, 0, 25, 21, 21, 96, 137, 21, 0, 0, 25, 14, 18, 72, 25, 13, 18, 64, 25, 12, 18, 56, 25, 11, 18, 48, 25, 10, 18, 40, 25, 6, 18, 32, 25, 3, 18, 24, 25, 2, 18, 16, 25, 8, 18, 76, 25, 16, 18, 82, 25, 17, 18, 80, 85, 8, 1, 0, 2, 22, 0, 0, 143, 1, 4, 0, 135, 21, 171, 0, 1, 22, 0, 0, 121, 21, 29, 0, 2, 23, 0, 0, 61, 255, 3, 0, 135, 22, 146, 0, 23, 0, 0, 0, 135, 21, 147, 0, 0, 22, 18, 0, 2, 21, 0, 0, 238, 7, 4, 0, 135, 1, 146, 0, 21, 0, 0, 0, 2, 22, 0, 0, 164, 72, 4, 0, 25, 23, 18, 8, 135, 21, 147, 0, 0, 22, 23, 0, 2, 23, 0, 0, 140, 73, 4, 0, 135, 21, 106, 0, 23, 1, 0, 0, 120, 21, 6, 0, 2, 23, 0, 0, 9, 8, 4, 0, 135, 21, 147, 0, 0, 23, 3, 0, 119, 0, 194, 0, 135, 21, 147, 0, 0, 1, 2, 0, 119, 0, 191, 0, 2, 21, 0, 0, 99, 21, 4, 0, 135, 9, 171, 0, 1, 21, 0, 0, 2, 21, 0, 0, 114, 21, 4, 0, 135, 15, 171, 0, 1, 21, 0, 0, 2, 23, 0, 0, 145, 21, 4, 0, 135, 21, 171, 0, 1, 23, 0, 0, 120, 1, 4, 0, 1, 1, 0, 0, 1, 7, 18, 0, 119, 0, 58, 0, 135, 21, 69, 0, 1, 0, 0, 0, 3, 5, 1, 21, 135, 21, 172, 0, 8, 0, 0, 0, 82, 1, 8, 0, 135, 3, 173, 0, 1, 0, 0, 0, 33, 4, 3, 0, 121, 4, 16, 0, 78, 21, 3, 0, 121, 21, 14, 0, 102, 23, 3, 1, 135, 21, 11, 1, 23, 0, 0, 0, 33, 21, 21, 99, 121, 21, 9, 0, 2, 21, 0, 0, 170, 3, 4, 0, 135, 17, 146, 0, 21, 0, 0, 0, 85, 6, 3, 0, 135, 21, 147, 0, 0, 17, 6, 0, 119, 0, 150, 0, 45, 21, 1, 3, 180, 13, 1, 0, 135, 21, 69, 0, 1, 0, 0, 0, 3, 21, 1, 21, 25, 1, 21, 1, 85, 8, 1, 0, 25, 2, 3, 2, 121, 4, 10, 0, 78, 23, 2, 0, 32, 23, 23, 58, 121, 23, 4, 0, 25, 23, 3, 3, 0, 21, 23, 0, 119, 0, 2, 0, 0, 21, 2, 0, 0, 2, 21, 0, 119, 0, 2, 0, 1, 2, 0, 0, 48, 21, 5, 1, 248, 13, 1, 0, 1, 21, 0, 0, 85, 8, 21, 0, 1, 1, 0, 0, 120, 2, 3, 0, 1, 7, 18, 0, 119, 0, 6, 0, 78, 21, 2, 0, 120, 21, 3, 0, 1, 7, 18, 0, 119, 0, 2, 0, 0, 4, 2, 0, 32, 21, 7, 18, 121, 21, 3, 0, 2, 4, 0, 0, 17, 8, 4, 0, 120, 15, 17, 0, 0, 2, 4, 0, 78, 1, 2, 0, 83, 16, 1, 0, 41, 21, 1, 24, 42, 21, 21, 24, 120, 21, 2, 0, 119, 0, 9, 0, 19, 23, 1, 19, 135, 21, 88, 0, 23, 0, 0, 0, 19, 21, 21, 19, 0, 7, 21, 0, 83, 2, 7, 0, 25, 2, 2, 1, 119, 0, 243, 255, 82, 1, 8, 0, 120, 1, 3, 0, 1, 1, 0, 0, 119, 0, 25, 0, 78, 21, 1, 0, 121, 21, 23, 0, 135, 21, 172, 0, 8, 0, 0, 0, 82, 1, 8, 0, 135, 2, 69, 0, 1, 0, 0, 0, 1, 21, 1, 0, 48, 21, 21, 2, 208, 14, 1, 0, 78, 21, 1, 0, 32, 21, 21, 34, 121, 21, 10, 0, 26, 21, 2, 1, 3, 2, 1, 21, 78, 21, 2, 0, 32, 21, 21, 34, 121, 21, 5, 0, 1, 21, 0, 0, 83, 2, 21, 0, 25, 1, 1, 1, 85, 8, 1, 0, 135, 21, 147, 0, 0, 1, 10, 0, 120, 9, 31, 0, 121, 1, 7, 0, 78, 21, 1, 0, 121, 21, 5, 0, 2, 23, 0, 0, 39, 108, 4, 0, 135, 21, 147, 0, 0, 23, 11, 0, 2, 23, 0, 0, 158, 123, 4, 0, 135, 21, 147, 0, 0, 23, 12, 0, 135, 1, 69, 0, 4, 0, 0, 0, 1, 2, 1, 0, 57, 21, 1, 2, 56, 15, 1, 0, 26, 21, 2, 1, 90, 21, 4, 21, 85, 14, 21, 0, 135, 21, 147, 0, 0, 20, 14, 0, 25, 2, 2, 1, 119, 0, 248, 255, 26, 21, 1, 1, 90, 21, 4, 21, 85, 13, 21, 0, 2, 23, 0, 0, 20, 8, 4, 0, 135, 21, 147, 0, 0, 23, 13, 0, 1, 21, 1, 0, 84, 17, 21, 0, 1, 23, 0, 0, 1, 22, 0, 0, 134, 21, 0, 0, 4, 58, 1, 0, 23, 16, 17, 22, 78, 1, 16, 0, 41, 21, 1, 24, 42, 21, 21, 24, 121, 21, 248, 255, 19, 21, 1, 19, 0, 3, 21, 0, 121, 15, 3, 0, 0, 2, 3, 0, 119, 0, 3, 0, 135, 2, 88, 0, 3, 0, 0, 0, 135, 2, 117, 0, 4, 2, 0, 0, 121, 2, 238, 255, 119, 0, 1, 0, 120, 15, 5, 0, 135, 21, 88, 0, 3, 0, 0, 0, 19, 21, 21, 19, 0, 1, 21, 0, 83, 16, 1, 0, 1, 22, 1, 0, 1, 23, 0, 0, 135, 21, 7, 0, 22, 16, 17, 23, 2, 21, 0, 0, 156, 72, 118, 1, 1, 23, 1, 0, 4, 23, 23, 4, 3, 23, 23, 2, 83, 21, 23, 0, 137, 18, 0, 0, 139, 0, 0, 0, 140, 0, 25, 0, 0, 0, 0, 0, 2, 14, 0, 0, 160, 178, 0, 0, 2, 15, 0, 0, 195, 15, 13, 0, 2, 16, 0, 0, 32, 3, 0, 0, 136, 17, 0, 0, 0, 12, 17, 0, 136, 17, 0, 0, 25, 17, 17, 16, 137, 17, 0, 0, 0, 11, 12, 0, 2, 17, 0, 0, 86, 46, 203, 1, 78, 17, 17, 0, 120, 17, 79, 1, 135, 1, 135, 0, 2, 17, 0, 0, 16, 63, 52, 0, 82, 17, 17, 0, 2, 18, 0, 0, 32, 63, 52, 0, 82, 18, 18, 0, 3, 10, 17, 18, 2, 18, 0, 0, 16, 63, 52, 0, 85, 18, 10, 0, 2, 18, 0, 0, 28, 63, 52, 0, 82, 0, 18, 0, 50, 18, 1, 0, 160, 16, 1, 0, 2, 18, 0, 0, 32, 63, 52, 0, 1, 17, 0, 0, 85, 18, 17, 0, 2, 17, 0, 0, 12, 63, 52, 0, 1, 18, 0, 0, 85, 17, 18, 0, 119, 0, 74, 1, 4, 0, 1, 0, 2, 18, 0, 0, 24, 63, 52, 0, 85, 18, 0, 0, 2, 18, 0, 0, 28, 63, 52, 0, 85, 18, 1, 0, 2, 18, 0, 0, 12, 63, 52, 0, 82, 18, 18, 0, 3, 3, 18, 0, 2, 18, 0, 0, 12, 63, 52, 0, 85, 18, 3, 0, 1, 18, 20, 0, 48, 18, 18, 0, 248, 16, 1, 0, 2, 18, 0, 0, 24, 63, 52, 0, 1, 17, 20, 0, 85, 18, 17, 0, 1, 0, 20, 0, 2, 17, 0, 0, 32, 63, 52, 0, 85, 17, 0, 0, 2, 17, 0, 0, 89, 46, 203, 1, 78, 17, 17, 0, 33, 17, 17, 0, 2, 18, 0, 0, 90, 46, 203, 1, 78, 18, 18, 0, 32, 18, 18, 0, 19, 17, 17, 18, 121, 17, 39, 1, 1, 17, 249, 0, 16, 9, 17, 10, 1, 17, 249, 0, 15, 17, 17, 3, 20, 17, 9, 17, 120, 17, 22, 0, 1, 17, 15, 0, 16, 1, 17, 0, 1, 17, 4, 0, 16, 17, 17, 10, 19, 17, 17, 1, 120, 17, 16, 0, 120, 1, 2, 0, 119, 0, 25, 1, 2, 17, 0, 0, 128, 202, 2, 0, 82, 17, 17, 0, 28, 11, 17, 3, 2, 17, 0, 0, 128, 202, 2, 0, 1, 19, 232, 3, 15, 19, 19, 11, 1, 20, 232, 3, 125, 18, 19, 11, 20, 0, 0, 0, 85, 17, 18, 0, 119, 0, 12, 1, 34, 18, 3, 1, 121, 18, 6, 0, 2, 18, 0, 0, 12, 63, 52, 0, 1, 17, 1, 0, 85, 18, 17, 0, 1, 3, 1, 0, 2, 18, 0, 0, 136, 202, 2, 0, 82, 18, 18, 0, 2, 20, 0, 0, 0, 104, 1, 0, 5, 18, 18, 20, 1, 20, 16, 39, 6, 18, 18, 20, 5, 17, 18, 10, 7, 8, 17, 3, 2, 17, 0, 0, 128, 202, 2, 0, 82, 1, 17, 0, 34, 17, 1, 0, 41, 17, 17, 31, 42, 17, 17, 31, 0, 7, 17, 0, 1, 17, 0, 0, 135, 4, 12, 1, 1, 7, 10, 17, 135, 5, 4, 1, 1, 17, 0, 0, 15, 17, 17, 5, 32, 18, 5, 0, 1, 20, 0, 0, 16, 20, 20, 4, 19, 18, 18, 20, 20, 17, 17, 18, 121, 17, 125, 0, 2, 13, 0, 0, 136, 9, 51, 0, 82, 17, 13, 0, 77, 17, 17, 0, 61, 18, 0, 0, 0, 0, 128, 79, 106, 20, 13, 4, 76, 20, 20, 0, 65, 18, 18, 20, 63, 17, 17, 18, 77, 18, 4, 0, 61, 20, 0, 0, 0, 0, 128, 79, 76, 19, 5, 0, 65, 20, 20, 19, 63, 18, 18, 20, 66, 2, 17, 18, 59, 18, 1, 0, 71, 18, 2, 18, 121, 18, 103, 0, 59, 18, 1, 0, 64, 6, 18, 2, 76, 18, 8, 0, 65, 18, 6, 18, 75, 13, 18, 0, 34, 18, 3, 10, 19, 18, 9, 18, 0, 9, 18, 0, 1, 18, 0, 64, 15, 18, 18, 13, 19, 18, 9, 18, 1, 17, 0, 64, 125, 13, 18, 17, 13, 0, 0, 0, 2, 17, 0, 0, 80, 195, 0, 0, 15, 17, 17, 1, 1, 18, 0, 20, 15, 18, 18, 13, 19, 18, 9, 18, 19, 17, 17, 18, 1, 18, 0, 20, 125, 13, 17, 18, 13, 0, 0, 0, 26, 18, 10, 5, 35, 18, 18, 16, 1, 17, 15, 0, 16, 17, 17, 0, 19, 18, 18, 17, 15, 17, 16, 13, 19, 18, 18, 17, 125, 0, 18, 16, 13, 0, 0, 0, 1, 18, 1, 4, 47, 18, 0, 18, 56, 19, 1, 0, 59, 18, 1, 0, 63, 18, 6, 18, 59, 17, 0, 4, 76, 20, 0, 0, 66, 17, 17, 20, 63, 17, 6, 17, 66, 18, 18, 17, 76, 17, 1, 0, 65, 18, 18, 17, 75, 18, 18, 0, 25, 1, 18, 1, 119, 0, 59, 0, 76, 18, 0, 0, 59, 17, 0, 252, 63, 18, 18, 17, 65, 18, 6, 18, 59, 17, 0, 4, 63, 6, 18, 17, 75, 17, 6, 0, 135, 20, 13, 1, 6, 0, 0, 0, 59, 19, 1, 0, 74, 20, 20, 19, 121, 20, 29, 0, 59, 19, 0, 0, 73, 19, 6, 19, 121, 19, 14, 0, 61, 22, 0, 0, 0, 0, 128, 79, 66, 22, 6, 22, 135, 21, 14, 1, 22, 0, 0, 0, 62, 22, 0, 0, 0, 0, 224, 255, 255, 255, 239, 65, 135, 19, 15, 1, 21, 22, 0, 0, 75, 19, 19, 0, 0, 20, 19, 0, 119, 0, 11, 0, 75, 22, 6, 0, 77, 22, 22, 0, 64, 22, 6, 22, 61, 21, 0, 0, 0, 0, 128, 79, 66, 22, 22, 21, 135, 19, 16, 1, 22, 0, 0, 0, 75, 19, 19, 0, 0, 20, 19, 0, 0, 18, 20, 0, 119, 0, 3, 0, 1, 20, 0, 0, 0, 18, 20, 0, 135, 13, 12, 1, 17, 18, 1, 7, 135, 18, 4, 1, 1, 17, 0, 8, 1, 20, 0, 0, 135, 13, 17, 1, 13, 18, 17, 20, 135, 20, 4, 1, 42, 20, 1, 1, 25, 20, 20, 1, 3, 1, 20, 13, 119, 0, 5, 0, 0, 0, 8, 0, 119, 0, 3, 0, 0, 0, 8, 0, 59, 2, 0, 0, 1, 20, 232, 3, 15, 20, 20, 1, 1, 17, 232, 3, 125, 1, 20, 1, 17, 0, 0, 0, 1, 20, 21, 0, 1, 18, 2, 0, 135, 17, 3, 0, 11, 20, 18, 0, 2, 18, 0, 0, 254, 106, 3, 0, 2, 20, 0, 0, 128, 202, 2, 0, 82, 20, 20, 0, 76, 20, 20, 0, 76, 19, 1, 0, 76, 22, 0, 0, 2, 21, 0, 0, 12, 63, 52, 0, 82, 21, 21, 0, 76, 21, 21, 0, 2, 23, 0, 0, 16, 63, 52, 0, 82, 23, 23, 0, 77, 23, 23, 0, 2, 24, 0, 0, 32, 63, 52, 0, 82, 24, 24, 0, 77, 24, 24, 0, 135, 17, 18, 1, 11, 18, 20, 19, 22, 21, 23, 24, 2, 0, 0, 0, 1, 17, 10, 0, 47, 17, 17, 0, 56, 21, 1, 0, 1, 17, 120, 0, 15, 17, 17, 0, 2, 24, 0, 0, 12, 63, 52, 0, 82, 24, 24, 0, 1, 23, 188, 2, 15, 24, 24, 23, 20, 17, 17, 24, 121, 17, 26, 0, 2, 17, 0, 0, 128, 202, 2, 0, 85, 17, 1, 0, 2, 17, 0, 0, 140, 202, 2, 0, 82, 0, 17, 0, 1, 17, 0, 0, 47, 17, 17, 0, 16, 21, 1, 0, 56, 17, 1, 0, 56, 21, 1, 0, 2, 17, 0, 0, 128, 202, 2, 0, 85, 17, 0, 0, 119, 0, 11, 0, 2, 17, 0, 0, 128, 132, 30, 0, 56, 17, 1, 17, 56, 21, 1, 0, 2, 17, 0, 0, 128, 202, 2, 0, 2, 24, 0, 0, 128, 132, 30, 0, 85, 17, 24, 0, 119, 0, 1, 0, 2, 13, 0, 0, 136, 9, 51, 0, 1, 24, 0, 0, 85, 13, 24, 0, 1, 17, 0, 0, 109, 13, 4, 17, 2, 17, 0, 0, 12, 63, 52, 0, 1, 24, 0, 0, 85, 17, 24, 0, 2, 24, 0, 0, 16, 63, 52, 0, 1, 17, 0, 0, 85, 24, 17, 0, 119, 0, 21, 0, 2, 17, 0, 0, 24, 63, 52, 0, 1, 24, 5, 0, 85, 17, 24, 0, 135, 13, 135, 0, 2, 24, 0, 0, 28, 63, 52, 0, 85, 24, 13, 0, 2, 24, 0, 0, 32, 63, 52, 0, 1, 17, 0, 0, 85, 24, 17, 0, 2, 17, 0, 0, 12, 63, 52, 0, 1, 24, 0, 0, 85, 17, 24, 0, 2, 24, 0, 0, 16, 63, 52, 0, 1, 17, 0, 0, 85, 24, 17, 0, 137, 12, 0, 0, 139, 0, 0, 0, 140, 1, 19, 0, 0, 0, 0, 0, 2, 15, 0, 0, 255, 255, 0, 0, 1, 4, 0, 0, 136, 16, 0, 0, 0, 14, 16, 0, 136, 16, 0, 0, 25, 16, 16, 80, 137, 16, 0, 0, 25, 13, 14, 48, 25, 9, 14, 40, 25, 10, 14, 24, 25, 3, 14, 16, 25, 2, 14, 8, 0, 8, 14, 0, 25, 5, 14, 54, 25, 12, 14, 52, 25, 11, 14, 56, 2, 17, 0, 0, 164, 72, 4, 0, 135, 16, 147, 0, 0, 17, 8, 0, 2, 16, 0, 0, 204, 72, 118, 1, 135, 1, 19, 1, 16, 0, 0, 0, 2, 16, 0, 0, 204, 72, 118, 1, 135, 6, 82, 0, 16, 0, 0, 0, 135, 7, 80, 0, 41, 16, 1, 16, 42, 16, 16, 16, 33, 1, 16, 255, 121, 1, 9, 0, 38, 16, 6, 1, 121, 16, 4, 0, 1, 17, 0, 0, 135, 16, 83, 0, 17, 0, 0, 0, 1, 17, 0, 0, 135, 16, 81, 0, 17, 0, 0, 0, 1, 16, 255, 255, 84, 5, 16, 0, 135, 16, 70, 0, 8, 5, 0, 0, 2, 16, 0, 0, 4, 63, 52, 0, 82, 16, 16, 0, 32, 16, 16, 3, 121, 16, 40, 0, 2, 17, 0, 0, 0, 0, 2, 0, 135, 16, 15, 0, 17, 0, 0, 0, 41, 16, 16, 24, 42, 16, 16, 24, 32, 16, 16, 90, 121, 16, 30, 0, 2, 17, 0, 0, 1, 0, 2, 0, 135, 16, 5, 0, 17, 0, 0, 0, 41, 16, 16, 16, 42, 16, 16, 16, 120, 16, 21, 0, 2, 17, 0, 0, 3, 0, 2, 0, 135, 16, 5, 0, 17, 0, 0, 0, 41, 16, 16, 16, 42, 16, 16, 16, 1, 17, 254, 127, 45, 16, 16, 17, 36, 23, 1, 0, 2, 16, 0, 0, 220, 179, 3, 0, 135, 3, 146, 0, 16, 0, 0, 0, 1, 16, 255, 1, 85, 2, 16, 0, 135, 16, 147, 0, 0, 3, 2, 0, 119, 0, 8, 0, 1, 4, 10, 0, 119, 0, 6, 0, 1, 4, 10, 0, 119, 0, 4, 0, 1, 4, 10, 0, 119, 0, 2, 0, 1, 4, 10, 0, 32, 16, 4, 10, 121, 16, 11, 0, 2, 16, 0, 0, 220, 179, 3, 0, 135, 4, 146, 0, 16, 0, 0, 0, 81, 16, 5, 0, 43, 16, 16, 6, 19, 16, 16, 15, 85, 3, 16, 0, 135, 16, 147, 0, 0, 4, 3, 0, 121, 1, 70, 0, 1, 17, 1, 0, 135, 16, 83, 0, 17, 0, 0, 0, 1, 17, 64, 0, 135, 16, 81, 0, 17, 0, 0, 0, 1, 2, 0, 0, 1, 3, 0, 0, 1, 4, 0, 0, 1, 16, 255, 255, 84, 5, 16, 0, 135, 16, 70, 0, 8, 5, 0, 0, 80, 1, 5, 0, 41, 16, 1, 16, 42, 16, 16, 16, 120, 16, 2, 0, 119, 0, 18, 0, 135, 16, 70, 0, 8, 5, 0, 0, 25, 16, 2, 1, 41, 16, 16, 16, 42, 16, 16, 16, 0, 2, 16, 0, 19, 16, 3, 15, 19, 17, 1, 15, 15, 16, 16, 17, 125, 3, 16, 1, 3, 0, 0, 0, 19, 16, 1, 15, 19, 17, 4, 15, 3, 16, 16, 17, 19, 16, 16, 15, 0, 4, 16, 0, 119, 0, 231, 255], eb + 61440);
  HEAPU8.set([2, 17, 0, 0, 204, 72, 118, 1, 135, 16, 82, 0, 17, 0, 0, 0, 21, 16, 16, 6, 38, 16, 16, 1, 121, 16, 5, 0, 1, 17, 255, 0, 19, 17, 6, 17, 135, 16, 83, 0, 17, 0, 0, 0, 1, 17, 255, 0, 19, 17, 7, 17, 135, 16, 81, 0, 17, 0, 0, 0, 41, 16, 2, 16, 42, 16, 16, 16, 121, 16, 17, 0, 2, 16, 0, 0, 115, 180, 3, 0, 135, 8, 146, 0, 16, 0, 0, 0, 19, 16, 4, 15, 43, 16, 16, 6, 19, 16, 16, 15, 85, 10, 16, 0, 19, 17, 2, 15, 109, 10, 4, 17, 19, 16, 3, 15, 43, 16, 16, 6, 19, 16, 16, 15, 109, 10, 8, 16, 135, 16, 147, 0, 0, 8, 10, 0, 2, 16, 0, 0, 200, 68, 118, 1, 1, 17, 0, 67, 84, 16, 17, 0, 1, 16, 47, 0, 134, 17, 0, 0, 28, 73, 1, 0, 16, 0, 0, 0, 2, 17, 0, 0, 200, 68, 118, 1, 78, 17, 17, 0, 32, 17, 17, 128, 121, 17, 36, 0, 2, 17, 0, 0, 200, 68, 118, 1, 1, 16, 16, 67, 84, 17, 16, 0, 1, 17, 47, 0, 134, 16, 0, 0, 28, 73, 1, 0, 17, 0, 0, 0, 2, 16, 0, 0, 136, 69, 118, 1, 80, 8, 16, 0, 2, 16, 0, 0, 212, 68, 118, 1, 80, 10, 16, 0, 2, 16, 0, 0, 201, 68, 118, 1, 1, 17, 8, 0, 83, 16, 17, 0, 134, 17, 0, 0, 180, 68, 1, 0, 8, 10, 0, 0, 2, 17, 0, 0, 212, 68, 118, 1, 78, 17, 17, 0, 120, 17, 11, 0, 2, 17, 0, 0, 17, 180, 3, 0, 135, 10, 146, 0, 17, 0, 0, 0, 2, 17, 0, 0, 208, 68, 118, 1, 81, 17, 17, 0, 85, 9, 17, 0, 135, 17, 147, 0, 0, 10, 9, 0, 0, 1, 11, 0, 2, 2, 0, 0, 250, 214, 3, 0, 25, 3, 1, 9, 78, 17, 2, 0, 83, 1, 17, 0, 25, 1, 1, 1, 25, 2, 2, 1, 54, 17, 1, 3, 88, 25, 1, 0, 1, 16, 0, 0, 1, 18, 0, 0, 135, 17, 56, 0, 11, 16, 12, 18, 121, 17, 24, 0, 80, 18, 12, 0, 1, 16, 0, 0, 135, 17, 57, 0, 18, 16, 0, 0, 2, 17, 0, 0, 201, 68, 118, 1, 1, 16, 66, 0, 83, 17, 16, 0, 1, 17, 103, 0, 134, 16, 0, 0, 28, 73, 1, 0, 17, 0, 0, 0, 2, 16, 0, 0, 66, 180, 3, 0, 135, 12, 146, 0, 16, 0, 0, 0, 2, 16, 0, 0, 212, 68, 118, 1, 81, 16, 16, 0, 41, 16, 16, 4, 85, 13, 16, 0, 135, 16, 147, 0, 0, 12, 13, 0, 137, 14, 0, 0, 139, 0, 0, 0, 140, 2, 22, 0, 0, 0, 0, 0, 2, 17, 0, 0, 95, 10, 4, 0, 1, 15, 0, 0, 136, 18, 0, 0, 0, 16, 18, 0, 136, 18, 0, 0, 25, 18, 18, 48, 137, 18, 0, 0, 25, 5, 16, 16, 25, 4, 16, 8, 25, 13, 16, 37, 25, 2, 16, 28, 25, 3, 16, 24, 25, 14, 16, 34, 25, 11, 16, 32, 25, 8, 16, 20, 25, 7, 16, 36, 1, 19, 13, 0, 1, 20, 2, 0, 135, 18, 3, 0, 13, 19, 20, 0, 2, 20, 0, 0, 136, 231, 3, 0, 135, 18, 63, 0, 13, 20, 1, 0, 78, 18, 1, 0, 32, 18, 18, 64, 121, 18, 3, 0, 1, 18, 32, 0, 83, 1, 18, 0, 135, 13, 225, 0, 1, 0, 0, 0, 1, 18, 0, 0, 85, 2, 18, 0, 1, 18, 0, 0, 85, 3, 18, 0, 1, 18, 0, 0, 85, 8, 18, 0, 1, 18, 1, 0, 1, 19, 0, 0, 135, 20, 20, 1, 19, 13, 2, 3, 7, 0, 0, 0, 48, 18, 18, 20, 180, 26, 1, 0, 2, 20, 0, 0, 161, 231, 3, 0, 135, 18, 45, 0, 20, 16, 0, 0, 82, 12, 2, 0, 33, 1, 12, 0, 82, 6, 3, 0, 33, 18, 6, 0, 20, 18, 1, 18, 121, 18, 179, 0, 25, 10, 0, 20, 82, 20, 10, 0, 1, 19, 0, 0, 135, 18, 17, 0, 20, 19, 0, 0, 41, 18, 18, 24, 42, 18, 18, 24, 33, 9, 18, 255, 82, 19, 10, 0, 1, 20, 1, 0, 135, 18, 17, 0, 19, 20, 0, 0, 41, 18, 18, 24, 42, 18, 18, 24, 33, 10, 18, 255, 120, 12, 3, 0, 1, 3, 1, 0, 119, 0, 27, 0, 1, 20, 0, 0, 1, 19, 0, 0, 135, 18, 56, 0, 12, 20, 14, 19, 121, 18, 21, 0, 80, 19, 14, 0, 1, 20, 0, 0, 135, 18, 57, 0, 19, 20, 0, 0, 85, 4, 12, 0, 2, 20, 0, 0, 209, 231, 3, 0, 135, 18, 45, 0, 20, 4, 0, 0, 121, 9, 5, 0, 1, 20, 0, 0, 1, 19, 0, 0, 135, 18, 57, 0, 20, 19, 0, 0, 1, 19, 0, 0, 1, 20, 0, 0, 135, 18, 56, 0, 12, 19, 14, 20, 1, 3, 0, 0, 119, 0, 2, 0, 1, 3, 0, 0, 120, 6, 4, 0, 1, 1, 1, 0, 1, 15, 27, 0, 119, 0, 74, 0, 85, 5, 6, 0, 2, 20, 0, 0, 239, 231, 3, 0, 135, 18, 45, 0, 20, 5, 0, 0, 121, 10, 5, 0, 1, 20, 1, 0, 1, 19, 0, 0, 135, 18, 57, 0, 20, 19, 0, 0, 20, 18, 1, 9, 0, 2, 18, 0, 120, 2, 5, 0, 1, 19, 2, 0, 1, 20, 0, 0, 135, 18, 56, 0, 17, 19, 14, 20, 78, 18, 7, 0, 120, 18, 9, 0, 1, 18, 2, 0, 1, 20, 32, 0, 1, 19, 18, 0, 135, 1, 92, 0, 6, 18, 20, 19, 14, 11, 0, 0, 1, 15, 22, 0, 119, 0, 18, 0, 1, 20, 2, 0, 1, 18, 0, 0, 135, 19, 56, 0, 6, 20, 14, 18, 121, 19, 7, 0, 1, 18, 1, 0, 1, 20, 2, 0, 1, 21, 0, 0, 135, 19, 61, 0, 18, 8, 20, 21, 119, 0, 7, 0, 1, 19, 32, 0, 1, 21, 0, 0, 135, 1, 55, 0, 6, 19, 14, 21, 1, 15, 22, 0, 119, 0, 1, 0, 32, 21, 15, 22, 121, 21, 8, 0, 40, 21, 10, 1, 20, 21, 1, 21, 120, 21, 5, 0, 1, 19, 2, 0, 1, 20, 0, 0, 135, 21, 56, 0, 17, 19, 14, 20, 121, 2, 4, 0, 1, 1, 0, 0, 1, 15, 27, 0, 119, 0, 17, 0, 1, 20, 0, 0, 1, 19, 0, 0, 135, 21, 57, 0, 20, 19, 0, 0, 134, 21, 0, 0, 184, 40, 1, 0, 0, 13, 0, 0, 121, 3, 7, 0, 1, 19, 1, 0, 1, 20, 0, 0, 135, 21, 57, 0, 19, 20, 0, 0, 1, 15, 33, 0, 119, 0, 3, 0, 1, 1, 0, 0, 1, 15, 28, 0, 32, 21, 15, 27, 121, 21, 9, 0, 134, 21, 0, 0, 184, 40, 1, 0, 0, 13, 0, 0, 121, 3, 4, 0, 120, 1, 54, 0, 1, 15, 32, 0, 119, 0, 2, 0, 1, 15, 28, 0, 32, 21, 15, 28, 121, 21, 14, 0, 1, 20, 0, 0, 1, 19, 0, 0, 135, 21, 57, 0, 20, 19, 0, 0, 121, 9, 5, 0, 1, 19, 2, 0, 1, 20, 0, 0, 135, 21, 56, 0, 17, 19, 14, 20, 135, 21, 21, 1, 12, 0, 0, 0, 120, 1, 37, 0, 1, 15, 32, 0, 32, 21, 15, 32, 121, 21, 13, 0, 1, 20, 1, 0, 1, 19, 0, 0, 135, 21, 57, 0, 20, 19, 0, 0, 121, 9, 7, 0, 121, 10, 7, 0, 1, 19, 2, 0, 1, 20, 0, 0, 135, 21, 56, 0, 17, 19, 14, 20, 119, 0, 2, 0, 1, 15, 33, 0, 32, 21, 15, 33, 121, 21, 14, 0, 1, 20, 2, 0, 1, 19, 0, 0, 135, 21, 56, 0, 17, 20, 14, 19, 121, 10, 5, 0, 1, 19, 2, 0, 1, 20, 0, 0, 135, 21, 56, 0, 17, 19, 14, 20, 1, 20, 0, 0, 1, 19, 0, 0, 135, 21, 57, 0, 20, 19, 0, 0, 135, 21, 21, 1, 6, 0, 0, 0, 119, 0, 4, 0, 134, 21, 0, 0, 184, 40, 1, 0, 0, 13, 0, 0, 137, 16, 0, 0, 139, 0, 0, 0, 140, 1, 17, 0, 0, 0, 0, 0, 2, 12, 0, 0, 164, 72, 4, 0, 136, 13, 0, 0, 0, 11, 13, 0, 136, 13, 0, 0, 1, 14, 128, 16, 3, 13, 13, 14, 137, 13, 0, 0, 1, 13, 40, 16, 3, 8, 11, 13, 1, 13, 32, 16, 3, 3, 11, 13, 1, 13, 24, 16, 3, 7, 11, 13, 1, 13, 16, 16, 3, 6, 11, 13, 1, 13, 8, 16, 3, 5, 11, 13, 1, 13, 0, 16, 3, 2, 11, 13, 0, 9, 11, 0, 1, 13, 112, 16, 3, 10, 11, 13, 1, 13, 48, 16, 3, 4, 11, 13, 1, 14, 0, 0, 1, 15, 0, 16, 135, 13, 240, 0, 9, 14, 15, 0, 1, 13, 0, 0, 85, 10, 13, 0, 1, 15, 0, 0, 109, 10, 4, 15, 1, 13, 0, 0, 109, 10, 8, 13, 1, 1, 0, 0, 32, 13, 1, 3, 120, 13, 6, 0, 41, 13, 1, 2, 1, 15, 0, 0, 97, 10, 13, 15, 25, 1, 1, 1, 119, 0, 250, 255, 25, 1, 0, 16, 82, 13, 1, 0, 2, 14, 0, 0, 31, 231, 3, 0, 135, 15, 22, 1, 13, 14, 10, 0, 121, 15, 29, 0, 102, 13, 10, 11, 34, 13, 13, 0, 121, 13, 4, 0, 82, 13, 10, 0, 0, 14, 13, 0, 119, 0, 2, 0, 0, 14, 10, 0, 135, 15, 95, 0, 9, 14, 0, 0, 2, 15, 0, 0, 34, 231, 3, 0, 135, 1, 175, 0, 9, 15, 0, 0, 121, 1, 3, 0, 1, 15, 0, 0, 83, 1, 15, 0, 135, 15, 23, 1, 4, 0, 0, 0, 102, 14, 0, 60, 107, 4, 60, 14, 134, 14, 0, 0, 232, 25, 1, 0, 4, 9, 0, 0, 135, 14, 24, 1, 4, 0, 0, 0, 135, 14, 25, 1, 4, 0, 0, 0, 119, 0, 126, 0, 82, 15, 1, 0, 2, 13, 0, 0, 37, 231, 3, 0, 1, 16, 1, 0, 135, 14, 188, 0, 15, 13, 10, 16, 121, 14, 54, 0, 2, 14, 0, 0, 43, 231, 3, 0, 135, 1, 146, 0, 14, 0, 0, 0, 2, 14, 0, 0, 32, 91, 4, 0, 85, 2, 14, 0, 135, 14, 147, 0, 0, 1, 2, 0, 2, 14, 0, 0, 4, 63, 52, 0, 82, 1, 14, 0, 32, 14, 1, 1, 121, 14, 10, 0, 2, 13, 0, 0, 63, 231, 3, 0, 135, 16, 146, 0, 13, 0, 0, 0, 135, 14, 147, 0, 0, 16, 5, 0, 2, 14, 0, 0, 4, 63, 52, 0, 82, 1, 14, 0, 120, 1, 7, 0, 2, 13, 0, 0, 81, 231, 3, 0, 135, 16, 146, 0, 13, 0, 0, 0, 135, 14, 147, 0, 0, 16, 6, 0, 2, 13, 0, 0, 100, 231, 3, 0, 135, 16, 146, 0, 13, 0, 0, 0, 135, 14, 147, 0, 0, 16, 7, 0, 102, 13, 10, 11, 34, 13, 13, 0, 121, 13, 4, 0, 82, 13, 10, 0, 0, 16, 13, 0, 119, 0, 2, 0, 0, 16, 10, 0, 135, 14, 95, 0, 9, 16, 0, 0, 1, 16, 0, 0, 1, 13, 255, 255, 135, 14, 26, 1, 10, 16, 13, 0, 134, 14, 0, 0, 232, 25, 1, 0, 0, 9, 0, 0, 119, 0, 10, 0, 2, 14, 0, 0, 118, 231, 3, 0, 135, 7, 146, 0, 14, 0, 0, 0, 2, 14, 0, 0, 32, 91, 4, 0, 85, 3, 14, 0, 135, 14, 147, 0, 0, 7, 3, 0, 25, 2, 0, 56, 25, 3, 0, 60, 25, 4, 0, 61, 82, 1, 2, 0, 120, 1, 24, 0, 78, 14, 3, 0, 121, 14, 3, 0, 135, 14, 27, 1, 0, 0, 0, 0, 134, 14, 0, 0, 4, 53, 0, 0, 0, 9, 0, 0, 135, 16, 28, 1, 135, 13, 29, 1, 16, 0, 0, 0, 1, 16, 0, 16, 135, 14, 30, 1, 13, 9, 16, 0, 134, 14, 0, 0, 232, 25, 1, 0, 0, 9, 0, 0, 78, 14, 3, 0, 121, 14, 32, 0, 82, 14, 2, 0, 120, 14, 30, 0, 135, 14, 31, 1, 0, 12, 0, 0, 119, 0, 27, 0, 82, 16, 1, 0, 106, 16, 16, 8, 1, 13, 255, 0, 19, 16, 16, 13, 135, 14, 18, 0, 16, 1, 9, 0, 121, 14, 20, 0, 78, 14, 3, 0, 32, 14, 14, 0, 78, 16, 9, 0, 32, 16, 16, 64, 20, 14, 14, 16, 120, 14, 7, 0, 135, 14, 27, 1, 0, 0, 0, 0, 135, 14, 31, 1, 0, 9, 0, 0, 135, 14, 31, 1, 0, 12, 0, 0, 134, 14, 0, 0, 232, 25, 1, 0, 0, 9, 0, 0, 78, 14, 3, 0, 121, 14, 3, 0, 135, 14, 147, 0, 0, 12, 8, 0, 78, 14, 4, 0, 121, 14, 204, 255, 135, 14, 99, 0, 10, 0, 0, 0, 137, 11, 0, 0, 139, 0, 0, 0, 140, 3, 15, 0, 0, 0, 0, 0, 2, 8, 0, 0, 255, 255, 0, 0, 2, 9, 0, 0, 201, 68, 118, 1, 2, 10, 0, 0, 200, 68, 118, 1, 1, 4, 0, 0, 80, 7, 10, 0, 135, 11, 32, 1, 25, 6, 0, 36, 78, 0, 6, 0, 41, 11, 0, 24, 42, 11, 11, 24, 120, 11, 3, 0, 1, 0, 0, 0, 119, 0, 17, 0, 80, 11, 2, 0, 120, 11, 3, 0, 1, 0, 0, 0, 119, 0, 13, 0, 83, 1, 0, 0, 2, 11, 0, 0, 161, 72, 118, 1, 78, 11, 11, 0, 121, 11, 5, 0, 78, 12, 6, 0, 1, 13, 7, 0, 135, 11, 33, 1, 12, 13, 0, 0, 1, 11, 0, 0, 83, 6, 11, 0, 1, 0, 1, 0, 0, 5, 0, 0, 19, 11, 5, 8, 0, 3, 11, 0, 81, 11, 2, 0, 19, 13, 5, 8, 49, 11, 11, 13, 152, 33, 1, 0, 1, 4, 29, 0, 119, 0, 172, 0, 2, 13, 0, 0, 4, 63, 52, 0, 82, 13, 13, 0, 39, 13, 13, 1, 32, 13, 13, 5, 1, 12, 16, 0, 1, 14, 0, 0, 125, 11, 13, 12, 14, 0, 0, 0, 83, 9, 11, 0, 1, 14, 22, 0, 134, 11, 0, 0, 28, 73, 1, 0, 14, 0, 0, 0, 78, 0, 10, 0, 41, 11, 0, 24, 42, 11, 11, 24, 1, 12, 224, 255, 1, 14, 46, 0, 138, 11, 12, 14, 188, 34, 1, 0, 160, 34, 1, 0, 160, 34, 1, 0, 160, 34, 1, 0, 160, 34, 1, 0, 160, 34, 1, 0, 160, 34, 1, 0, 160, 34, 1, 0, 160, 34, 1, 0, 160, 34, 1, 0, 160, 34, 1, 0, 160, 34, 1, 0, 160, 34, 1, 0, 160, 34, 1, 0, 160, 34, 1, 0, 160, 34, 1, 0, 160, 34, 1, 0, 160, 34, 1, 0, 160, 34, 1, 0, 160, 34, 1, 0, 160, 34, 1, 0, 160, 34, 1, 0, 160, 34, 1, 0, 160, 34, 1, 0, 160, 34, 1, 0, 160, 34, 1, 0, 160, 34, 1, 0, 160, 34, 1, 0, 160, 34, 1, 0, 160, 34, 1, 0, 160, 34, 1, 0, 160, 34, 1, 0, 48, 35, 1, 0, 160, 34, 1, 0, 160, 34, 1, 0, 160, 34, 1, 0, 160, 34, 1, 0, 160, 34, 1, 0, 160, 34, 1, 0, 160, 34, 1, 0, 136, 35, 1, 0, 160, 34, 1, 0, 160, 34, 1, 0, 160, 34, 1, 0, 160, 34, 1, 0, 8, 36, 1, 0, 95, 1, 3, 0, 25, 12, 5, 1, 41, 12, 12, 16, 42, 12, 12, 16, 0, 0, 12, 0, 1, 4, 26, 0, 119, 0, 86, 0, 25, 14, 5, 1, 41, 14, 14, 16, 42, 14, 14, 16, 0, 0, 14, 0, 3, 3, 1, 3, 78, 14, 9, 0, 120, 14, 5, 0, 1, 14, 224, 255, 83, 3, 14, 0, 1, 4, 26, 0, 119, 0, 75, 0, 1, 14, 0, 0, 83, 3, 14, 0, 78, 3, 9, 0, 19, 14, 0, 8, 81, 12, 2, 0, 47, 14, 14, 12, 36, 35, 1, 0, 19, 14, 0, 8, 95, 1, 14, 3, 25, 14, 5, 2, 41, 14, 14, 16, 42, 14, 14, 16, 0, 0, 14, 0, 1, 4, 26, 0, 119, 0, 60, 0, 83, 6, 3, 0, 1, 4, 26, 0, 119, 0, 57, 0, 25, 14, 5, 1, 41, 14, 14, 16, 42, 14, 14, 16, 0, 0, 14, 0, 1, 12, 0, 0, 95, 1, 3, 12, 78, 3, 9, 0, 19, 12, 0, 8, 81, 14, 2, 0, 47, 12, 12, 14, 124, 35, 1, 0, 19, 12, 0, 8, 95, 1, 12, 3, 25, 12, 5, 2, 41, 12, 12, 16, 42, 12, 12, 16, 0, 0, 12, 0, 1, 4, 26, 0, 119, 0, 38, 0, 83, 6, 3, 0, 1, 4, 26, 0, 119, 0, 35, 0, 80, 14, 2, 0, 32, 14, 14, 1, 121, 14, 9, 0, 1, 12, 8, 0, 95, 1, 3, 12, 25, 12, 5, 1, 41, 12, 12, 16, 42, 12, 12, 16, 0, 0, 12, 0, 1, 4, 26, 0, 119, 0, 24, 0, 41, 12, 5, 16, 42, 12, 12, 16, 120, 12, 3, 0, 1, 0, 0, 0, 119, 0, 19, 0, 1, 14, 0, 0, 95, 1, 3, 14, 1, 12, 8, 0, 1, 13, 7, 0, 135, 14, 33, 1, 12, 13, 0, 0, 1, 13, 32, 0, 1, 12, 7, 0, 135, 14, 33, 1, 13, 12, 0, 0, 26, 14, 5, 1, 41, 14, 14, 16, 42, 14, 14, 16, 0, 0, 14, 0, 1, 4, 26, 0, 119, 0, 3, 0, 1, 4, 9, 0, 119, 0, 14, 0, 32, 11, 4, 26, 121, 11, 10, 0, 1, 4, 0, 0, 2, 11, 0, 0, 161, 72, 118, 1, 78, 11, 11, 0, 121, 11, 5, 0, 78, 12, 10, 0, 1, 14, 7, 0, 135, 11, 33, 1, 12, 14, 0, 0, 0, 5, 0, 0, 119, 0, 78, 255, 32, 11, 4, 9, 121, 11, 33, 0, 25, 11, 5, 1, 41, 11, 11, 16, 42, 11, 11, 16, 0, 0, 11, 0, 1, 14, 13, 0, 95, 1, 3, 14, 19, 14, 0, 8, 81, 11, 2, 0, 47, 14, 14, 11, 144, 36, 1, 0, 19, 14, 0, 8, 1, 11, 10, 0, 95, 1, 14, 11, 25, 11, 5, 2, 41, 11, 11, 16, 42, 11, 11, 16, 0, 0, 11, 0, 84, 2, 0, 0, 84, 10, 7, 0, 2, 11, 0, 0, 161, 72, 118, 1, 78, 11, 11, 0, 121, 11, 14, 0, 1, 14, 13, 0, 1, 12, 7, 0, 135, 11, 33, 1, 14, 12, 0, 0, 1, 12, 10, 0, 1, 14, 7, 0, 135, 11, 33, 1, 12, 14, 0, 0, 119, 0, 5, 0, 32, 11, 4, 29, 121, 11, 3, 0, 84, 2, 5, 0, 84, 10, 7, 0, 1, 11, 1, 0, 139, 11, 0, 0, 140, 4, 17, 0, 0, 0, 0, 0, 2, 11, 0, 0, 116, 106, 4, 0, 2, 12, 0, 0, 156, 16, 0, 0, 2, 13, 0, 0, 160, 17, 0, 0, 136, 14, 0, 0, 0, 10, 14, 0, 136, 14, 0, 0, 1, 15, 16, 1, 3, 14, 14, 15, 137, 14, 0, 0, 0, 8, 10, 0, 1, 14, 1, 1, 3, 9, 10, 14, 1, 14, 0, 1, 3, 5, 10, 14, 2, 15, 0, 0, 84, 165, 3, 0, 1, 16, 2, 0, 135, 14, 102, 0, 1, 15, 16, 0, 120, 14, 20, 0, 3, 4, 0, 13, 78, 14, 4, 0, 120, 14, 3, 0, 1, 4, 0, 0, 119, 0, 92, 0, 1, 14, 0, 0, 83, 4, 14, 0, 1, 16, 0, 0, 96, 0, 12, 16, 1, 14, 19, 0, 1, 15, 0, 0, 135, 16, 3, 0, 5, 14, 15, 0, 2, 15, 0, 0, 109, 165, 3, 0, 135, 16, 33, 0, 5, 15, 0, 0, 1, 4, 0, 0, 119, 0, 78, 0, 135, 16, 95, 0, 8, 1, 0, 0, 135, 5, 69, 0, 8, 0, 0, 0, 1, 16, 168, 17, 94, 4, 0, 16, 1, 16, 164, 17, 3, 7, 0, 16, 1, 6, 0, 0, 50, 16, 4, 6, 200, 37, 1, 0, 1, 4, 7, 0, 119, 0, 11, 0, 82, 15, 7, 0, 41, 14, 6, 2, 94, 15, 15, 14, 135, 16, 102, 0, 8, 15, 5, 0, 120, 16, 3, 0, 1, 4, 5, 0, 119, 0, 3, 0, 25, 6, 6, 1, 119, 0, 243, 255, 32, 16, 4, 5, 121, 16, 17, 0, 3, 4, 0, 13, 78, 16, 4, 0, 120, 16, 49, 0, 1, 16, 1, 0, 83, 4, 16, 0, 1, 15, 0, 0, 96, 0, 12, 15, 1, 16, 19, 0, 1, 14, 0, 0, 135, 15, 3, 0, 9, 16, 14, 0, 2, 14, 0, 0, 87, 165, 3, 0, 135, 15, 63, 0, 9, 14, 8, 0, 119, 0, 36, 0, 32, 15, 4, 7, 121, 15, 34, 0, 1, 15, 172, 17, 135, 6, 155, 0, 15, 0, 0, 0, 135, 15, 34, 1, 6, 0, 0, 0, 1, 14, 0, 0, 135, 15, 35, 1, 14, 1, 0, 0, 2, 14, 0, 0, 255, 255, 0, 0, 19, 15, 15, 14, 0, 5, 15, 0, 85, 3, 5, 0, 135, 4, 36, 1, 6, 1, 5, 0, 120, 4, 13, 0, 1, 15, 0, 0, 134, 4, 0, 0, 164, 104, 0, 0, 15, 11, 5, 0, 120, 4, 3, 0, 85, 2, 6, 0, 119, 0, 11, 0, 135, 15, 37, 1, 6, 0, 0, 0, 135, 15, 154, 0, 6, 0, 0, 0, 119, 0, 7, 0, 135, 15, 37, 1, 6, 0, 0, 0, 135, 15, 154, 0, 6, 0, 0, 0, 119, 0, 2, 0, 1, 4, 0, 0, 137, 10, 0, 0, 139, 4, 0, 0, 140, 1, 18, 0, 0, 0, 0, 0, 2, 12, 0, 0, 163, 190, 3, 0, 2, 13, 0, 0, 77, 195, 3, 0, 136, 14, 0, 0, 0, 9, 14, 0, 136, 14, 0, 0, 25, 14, 14, 80, 137, 14, 0, 0, 25, 8, 9, 40, 25, 7, 9, 32, 25, 6, 9, 24, 25, 5, 9, 16, 25, 4, 9, 8, 0, 3, 9, 0, 25, 10, 9, 64, 25, 1, 9, 56, 25, 11, 9, 48, 25, 2, 9, 72, 2, 16, 0, 0, 136, 72, 118, 1, 135, 15, 0, 0, 16, 0, 0, 0, 135, 14, 1, 0, 10, 15, 0, 0, 135, 10, 38, 1, 10, 0, 0, 0, 2, 16, 0, 0, 136, 72, 118, 1, 135, 15, 0, 0, 16, 0, 0, 0, 135, 14, 1, 0, 11, 15, 0, 0, 135, 15, 38, 1, 11, 0, 0, 0, 135, 14, 1, 0, 1, 15, 0, 0, 41, 14, 10, 16, 42, 14, 14, 16, 135, 15, 38, 1, 1, 0, 0, 0, 41, 15, 15, 16, 42, 15, 15, 16, 45, 14, 14, 15, 176, 40, 1, 0, 25, 1, 0, 16, 82, 15, 1, 0, 2, 16, 0, 0, 200, 173, 3, 0, 1, 17, 0, 0, 135, 14, 191, 0, 15, 16, 17, 0, 121, 14, 6, 0, 135, 17, 146, 0, 12, 0, 0, 0, 135, 14, 147, 0, 0, 17, 3, 0, 119, 0, 61, 0, 82, 17, 1, 0, 2, 16, 0, 0, 224, 214, 3, 0, 1, 15, 0, 0, 135, 14, 191, 0, 17, 16, 15, 0, 121, 14, 8, 0, 2, 15, 0, 0, 230, 214, 3, 0, 135, 14, 147, 0, 0, 15, 4, 0, 135, 14, 39, 1, 0, 0, 0, 0, 119, 0, 47, 0, 82, 15, 1, 0, 2, 16, 0, 0, 235, 214, 3, 0, 1, 17, 0, 0, 135, 14, 191, 0, 15, 16, 17, 0, 121, 14, 6, 0, 135, 17, 146, 0, 13, 0, 0, 0, 135, 14, 147, 0, 0, 17, 5, 0, 119, 0, 35, 0, 2, 16, 0, 0, 11, 183, 3, 0, 135, 17, 146, 0, 16, 0, 0, 0, 135, 14, 147, 0, 0, 17, 6, 0, 1, 14, 1, 0, 84, 2, 14, 0, 1, 17, 0, 0, 1, 16, 0, 0, 134, 14, 0, 0, 4, 58, 1, 0, 17, 6, 2, 16, 135, 14, 39, 1, 0, 0, 0, 0, 1, 16, 0, 0, 1, 17, 0, 0, 134, 14, 0, 0, 4, 58, 1, 0, 16, 6, 2, 17, 135, 17, 146, 0, 12, 0, 0, 0, 135, 14, 147, 0, 0, 17, 7, 0, 1, 17, 0, 0, 1, 16, 0, 0, 134, 14, 0, 0, 4, 58, 1, 0, 17, 6, 2, 16, 135, 16, 146, 0, 13, 0, 0, 0, 135, 14, 147, 0, 0, 16, 8, 0, 119, 0, 1, 0, 137, 9, 0, 0, 139, 0, 0, 0, 140, 2, 13, 0, 0, 0, 0, 0, 2, 8, 0, 0, 32, 73, 2, 0, 2, 9, 0, 0, 255, 0, 0, 0, 136, 10, 0, 0, 0, 7, 10, 0, 136, 10, 0, 0, 1, 11, 16, 16, 3, 10, 10, 11, 137, 10, 0, 0, 1, 10, 0, 16, 3, 6, 7, 10, 0, 5, 7, 0, 0, 3, 5, 0, 135, 4, 225, 0, 1, 0, 0, 0, 78, 1, 4, 0, 41, 10, 1, 24, 42, 10, 10, 24, 1, 11, 0, 0, 1, 12, 93, 0, 138, 10, 11, 12, 144, 42, 1, 0, 140, 42, 1, 0, 140, 42, 1, 0, 140, 42, 1, 0, 140, 42, 1, 0, 140, 42, 1, 0, 140, 42, 1, 0, 140, 42, 1, 0, 140, 42, 1, 0, 152, 42, 1, 0, 140, 42, 1, 0, 140, 42, 1, 0, 140, 42, 1, 0, 140, 42, 1, 0, 140, 42, 1, 0, 140, 42, 1, 0, 140, 42, 1, 0, 140, 42, 1, 0, 140, 42, 1, 0, 140, 42, 1, 0, 140, 42, 1, 0, 140, 42, 1, 0, 140, 42, 1, 0, 140, 42, 1, 0, 140, 42, 1, 0, 140, 42, 1, 0, 140, 42, 1, 0, 140, 42, 1, 0, 140, 42, 1, 0, 140, 42, 1, 0, 140, 42, 1, 0, 140, 42, 1, 0, 156, 42, 1, 0, 140, 42, 1, 0, 140, 42, 1, 0, 140, 42, 1, 0, 140, 42, 1, 0, 140, 42, 1, 0, 140, 42, 1, 0, 140, 42, 1, 0, 140, 42, 1, 0, 140, 42, 1, 0, 140, 42, 1, 0, 140, 42, 1, 0, 140, 42, 1, 0, 140, 42, 1, 0, 160, 42, 1, 0, 224, 42, 1, 0, 140, 42, 1, 0, 140, 42, 1, 0, 140, 42, 1, 0, 140, 42, 1, 0, 140, 42, 1, 0, 140, 42, 1, 0, 140, 42, 1, 0, 140, 42, 1, 0, 140, 42, 1, 0, 140, 42, 1, 0, 140, 42, 1, 0, 140, 42, 1, 0, 140, 42, 1, 0, 228, 42, 1, 0, 140, 42, 1, 0, 140, 42, 1, 0, 140, 42, 1, 0, 140, 42, 1, 0, 140, 42, 1, 0, 140, 42, 1, 0, 140, 42, 1, 0, 140, 42, 1, 0, 140, 42, 1, 0, 140, 42, 1, 0, 140, 42, 1, 0, 140, 42, 1, 0, 140, 42, 1, 0, 140, 42, 1, 0, 140, 42, 1, 0, 140, 42, 1, 0, 140, 42, 1, 0, 140, 42, 1, 0, 140, 42, 1, 0, 140, 42, 1, 0, 140, 42, 1, 0, 140, 42, 1, 0, 140, 42, 1, 0, 140, 42, 1, 0, 140, 42, 1, 0, 140, 42, 1, 0, 140, 42, 1, 0, 140, 42, 1, 0, 140, 42, 1, 0, 140, 42, 1, 0, 232, 42, 1, 0, 119, 0, 24, 0, 1, 2, 10, 0, 119, 0, 26, 0, 119, 0, 254, 255, 119, 0, 253, 255, 1, 11, 0, 0, 83, 3, 11, 0, 1, 1, 0, 0, 32, 11, 1, 34, 120, 11, 10, 0, 27, 12, 1, 20, 94, 12, 8, 12, 135, 11, 234, 0, 12, 5, 0, 0, 120, 11, 3, 0, 1, 2, 6, 0, 119, 0, 12, 0, 25, 1, 1, 1, 119, 0, 246, 255, 78, 1, 4, 0, 119, 0, 4, 0, 119, 0, 236, 255, 119, 0, 235, 255, 119, 0, 238, 255, 83, 3, 1, 0, 25, 3, 3, 1, 25, 4, 4, 1, 119, 0, 130, 255, 32, 10, 2, 6, 121, 10, 11, 0, 27, 10, 1, 20, 3, 6, 8, 10, 106, 11, 6, 8, 19, 11, 11, 9, 106, 12, 6, 12, 42, 12, 12, 1, 3, 12, 0, 12, 135, 10, 40, 1, 11, 12, 4, 0, 119, 0, 46, 0, 32, 10, 2, 10, 121, 10, 44, 0, 1, 10, 0, 0, 83, 3, 10, 0, 135, 10, 69, 0, 5, 0, 0, 0, 121, 10, 39, 0, 1, 1, 0, 0, 32, 10, 1, 34, 120, 10, 10, 0, 27, 11, 1, 20, 94, 11, 8, 11, 135, 10, 234, 0, 11, 5, 0, 0, 120, 10, 3, 0, 1, 2, 14, 0, 119, 0, 3, 0, 25, 1, 1, 1, 119, 0, 246, 255, 32, 10, 2, 14, 121, 10, 11, 0, 27, 10, 1, 20, 3, 6, 8, 10, 106, 11, 6, 8, 19, 11, 11, 9, 106, 12, 6, 12, 42, 12, 12, 1, 3, 12, 0, 12, 135, 10, 40, 1, 11, 12, 4, 0, 119, 0, 15, 0, 134, 10, 0, 0, 144, 232, 0, 0, 0, 5, 4, 0, 120, 10, 11, 0, 135, 10, 41, 1, 0, 5, 4, 0, 120, 10, 8, 0, 2, 10, 0, 0, 173, 254, 3, 0, 135, 4, 146, 0, 10, 0, 0, 0, 85, 6, 5, 0, 135, 10, 147, 0, 0, 4, 6, 0, 137, 7, 0, 0, 139, 0, 0, 0, 140, 2, 16, 0, 0, 0, 0, 0, 2, 9, 0, 0, 204, 68, 118, 1, 2, 10, 0, 0, 205, 68, 118, 1, 136, 11, 0, 0, 0, 8, 11, 0, 136, 11, 0, 0, 25, 11, 11, 80, 137, 11, 0, 0, 25, 4, 8, 48, 25, 3, 8, 40, 25, 5, 8, 32, 25, 7, 8, 24, 25, 6, 8, 16, 25, 2, 8, 64, 2, 12, 0, 0, 143, 1, 4, 0, 135, 11, 171, 0, 1, 12, 0, 0, 121, 11, 29, 0, 2, 13, 0, 0, 75, 1, 4, 0, 135, 12, 146, 0, 13, 0, 0, 0, 135, 11, 147, 0, 0, 12, 8, 0, 2, 11, 0, 0, 14, 2, 4, 0, 135, 1, 146, 0, 11, 0, 0, 0, 2, 12, 0, 0, 164, 72, 4, 0, 25, 13, 8, 8, 135, 11, 147, 0, 0, 12, 13, 0, 2, 13, 0, 0, 140, 73, 4, 0, 135, 11, 106, 0, 13, 1, 0, 0, 120, 11, 6, 0, 2, 13, 0, 0, 39, 2, 4, 0, 135, 11, 147, 0, 0, 13, 7, 0, 119, 0, 78, 0, 135, 11, 147, 0, 0, 1, 6, 0, 119, 0, 75, 0, 2, 13, 0, 0, 122, 21, 4, 0, 135, 11, 171, 0, 1, 13, 0, 0, 121, 11, 25, 0, 1, 11, 0, 0, 135, 7, 7, 1, 11, 0, 0, 0, 85, 2, 7, 0, 135, 7, 8, 1, 2, 0, 0, 0, 1, 13, 108, 4, 106, 12, 7, 4, 27, 12, 12, 60, 106, 14, 7, 8, 1, 15, 16, 14, 5, 14, 14, 15, 3, 12, 12, 14, 82, 14, 7, 0, 3, 12, 12, 14, 76, 12, 12, 0, 62, 14, 0, 0, 233, 31, 104, 248, 219, 52, 50, 64, 65, 12, 12, 14, 75, 12, 12, 0, 135, 11, 38, 0, 13, 12, 0, 0, 119, 0, 46, 0, 2, 11, 0, 0, 145, 21, 4, 0, 135, 7, 171, 0, 1, 11, 0, 0, 2, 11, 0, 0, 201, 68, 118, 1, 1, 12, 44, 0, 83, 11, 12, 0, 1, 11, 33, 0, 134, 12, 0, 0, 28, 73, 1, 0, 11, 0, 0, 0, 121, 7, 10, 0, 79, 7, 9, 0, 79, 12, 10, 0, 85, 5, 12, 0, 109, 5, 4, 7, 2, 11, 0, 0, 45, 2, 4, 0, 135, 12, 147, 0, 0, 11, 5, 0, 119, 0, 24, 0, 2, 13, 0, 0, 55, 2, 4, 0, 135, 11, 146, 0, 13, 0, 0, 0, 135, 12, 147, 0, 0, 11, 3, 0, 79, 5, 9, 0, 2, 12, 0, 0, 209, 68, 118, 1, 79, 6, 12, 0, 2, 12, 0, 0, 208, 68, 118, 1, 79, 7, 12, 0, 79, 12, 10, 0, 85, 4, 12, 0, 109, 4, 4, 5, 109, 4, 8, 6, 109, 4, 12, 7, 2, 11, 0, 0, 74, 2, 4, 0, 135, 12, 147, 0, 0, 11, 4, 0, 119, 0, 1, 0, 137, 8, 0, 0, 139, 0, 0, 0, 140, 2, 15, 0, 0, 0, 0, 0, 2, 9, 0, 0, 32, 73, 2, 0, 2, 10, 0, 0, 110, 5, 4, 0, 2, 11, 0, 0, 125, 46, 203, 1, 1, 7, 0, 0, 136, 12, 0, 0, 0, 8, 12, 0, 136, 12, 0, 0, 25, 12, 12, 48, 137, 12, 0, 0, 25, 6, 8, 40, 25, 4, 8, 32, 25, 3, 8, 24, 25, 2, 8, 16, 2, 13, 0, 0, 143, 1, 4, 0, 135, 12, 171, 0, 1, 13, 0, 0, 121, 12, 29, 0, 2, 14, 0, 0, 15, 0, 4, 0, 135, 13, 146, 0, 14, 0, 0, 0, 135, 12, 147, 0, 0, 13, 8, 0, 2, 12, 0, 0, 60, 5, 4, 0, 135, 1, 146, 0, 12, 0, 0, 0, 2, 13, 0, 0, 164, 72, 4, 0, 25, 14, 8, 8, 135, 12, 147, 0, 0, 13, 14, 0, 2, 14, 0, 0, 140, 73, 4, 0, 135, 12, 106, 0, 14, 1, 0, 0, 120, 12, 6, 0, 2, 14, 0, 0, 85, 5, 4, 0, 135, 12, 147, 0, 0, 14, 3, 0, 119, 0, 50, 0, 135, 12, 147, 0, 0, 1, 2, 0, 119, 0, 47, 0, 2, 12, 0, 0, 91, 5, 4, 0, 135, 5, 171, 0, 1, 12, 0, 0, 120, 5, 7, 0, 2, 13, 0, 0, 95, 5, 4, 0, 135, 14, 146, 0, 13, 0, 0, 0, 135, 12, 147, 0, 0, 14, 4, 0, 1, 3, 0, 0, 1, 1, 0, 0, 27, 12, 3, 20, 3, 2, 9, 12, 32, 12, 3, 34, 120, 12, 30, 0, 121, 5, 3, 0, 1, 7, 11, 0, 119, 0, 6, 0, 27, 12, 3, 20, 3, 12, 9, 12, 106, 12, 12, 4, 120, 12, 2, 0, 1, 7, 11, 0, 32, 12, 7, 11, 121, 12, 18, 0, 1, 7, 0, 0, 82, 2, 2, 0, 27, 12, 3, 20, 3, 12, 9, 12, 106, 12, 12, 16, 135, 4, 146, 0, 12, 0, 0, 0, 85, 6, 2, 0, 109, 6, 4, 4, 135, 12, 147, 0, 0, 10, 6, 0, 25, 1, 1, 1, 31, 12, 1, 22, 120, 12, 4, 0, 134, 12, 0, 0, 252, 56, 1, 0, 0, 11, 0, 0, 25, 3, 3, 1, 119, 0, 224, 255, 137, 8, 0, 0, 139, 0, 0, 0, 140, 2, 11, 0, 0, 0, 0, 0, 136, 6, 0, 0, 0, 4, 6, 0, 136, 6, 0, 0, 25, 6, 6, 32, 137, 6, 0, 0, 25, 3, 4, 8, 0, 2, 4, 0, 25, 5, 4, 16, 135, 6, 42, 1, 0, 1, 0, 0, 2, 6, 0, 0, 240, 205, 2, 0, 85, 0, 6, 0, 2, 6, 0, 0, 200, 72, 118, 1, 1, 7, 181, 1, 84, 6, 7, 0, 1, 7, 172, 17, 135, 0, 155, 0, 7, 0, 0, 0, 135, 7, 34, 1, 0, 0, 0, 0, 2, 7, 0, 0, 116, 72, 118, 1, 85, 7, 0, 0, 1, 7, 0, 0, 85, 5, 7, 0, 1, 6, 0, 0, 109, 5, 4, 6, 1, 7, 0, 0, 109, 5, 8, 7, 2, 6, 0, 0, 131, 165, 3, 0, 2, 9, 0, 0, 131, 165, 3, 0, 135, 8, 96, 0, 9, 0, 0, 0, 135, 7, 97, 0, 5, 6, 8, 0, 135, 0, 113, 0, 1, 5, 0, 0, 135, 7, 99, 0, 5, 0, 0, 0, 1, 8, 0, 0, 2, 6, 0, 0, 116, 106, 4, 0, 1, 10, 0, 0, 135, 9, 35, 1, 10, 0, 0, 0, 2, 10, 0, 0, 255, 255, 0, 0, 19, 9, 9, 10, 134, 7, 0, 0, 164, 104, 0, 0, 8, 6, 9, 0, 2, 9, 0, 0, 116, 72, 118, 1, 82, 9, 9, 0, 2, 6, 0, 0, 200, 72, 118, 1, 81, 6, 6, 0, 135, 7, 36, 1, 9, 0, 6, 0, 120, 7, 14, 0, 2, 7, 0, 0, 116, 72, 118, 1, 82, 7, 7, 0, 135, 1, 43, 1, 7, 0, 0, 0, 121, 1, 19, 0, 85, 3, 1, 0, 109, 3, 4, 0, 2, 6, 0, 0, 179, 165, 3, 0, 135, 7, 45, 0, 6, 3, 0, 0, 119, 0, 12, 0, 2, 6, 0, 0, 116, 106, 4, 0, 1, 9, 4, 0, 135, 7, 44, 1, 0, 6, 9, 0, 121, 7, 6, 0, 85, 2, 0, 0, 2, 9, 0, 0, 146, 165, 3, 0, 135, 7, 45, 0, 9, 2, 0, 0, 137, 4, 0, 0, 139, 0, 0, 0, 140, 0, 14, 0, 0, 0, 0, 0, 2, 5, 0, 0, 76, 105, 118, 1, 136, 6, 0, 0, 0, 3, 6, 0, 136, 6, 0, 0, 25, 6, 6, 16, 137, 6, 0, 0, 0, 0, 3, 0, 1, 6, 255, 255, 135, 1, 120, 0, 6, 0, 0, 0, 1, 7, 1, 0, 135, 6, 120, 0, 7, 0, 0, 0, 2, 6, 0, 0, 148, 46, 203, 1, 78, 6, 6, 0, 120, 6, 3, 0, 1, 2, 0, 0, 119, 0, 3, 0, 135, 6, 122, 0, 1, 2, 1, 0, 1, 7, 0, 0, 135, 6, 45, 1, 7, 0, 0, 0, 1, 6, 128, 2, 1, 7, 224, 1, 1, 8, 0, 0, 1, 9, 0, 0, 135, 4, 123, 0, 6, 7, 8, 9, 2, 9, 0, 0, 52, 105, 118, 1, 85, 9, 4, 0, 120, 4, 7, 0, 135, 4, 124, 0, 85, 0, 4, 0, 2, 8, 0, 0, 110, 11, 4, 0, 135, 9, 11, 0, 8, 0, 0, 0, 1, 9, 0, 0, 1, 8, 128, 2, 1, 7, 224, 1, 1, 6, 8, 0, 1, 10, 0, 0, 1, 11, 0, 0, 1, 12, 0, 0, 1, 13, 0, 0, 135, 0, 127, 0, 9, 8, 7, 6, 10, 11, 12, 13, 2, 13, 0, 0, 56, 105, 118, 1, 85, 13, 0, 0, 1, 12, 3, 0, 2, 11, 0, 0, 224, 75, 2, 0, 1, 10, 0, 0, 1, 6, 6, 0, 135, 13, 46, 1, 0, 12, 11, 10, 6, 0, 0, 0, 2, 13, 0, 0, 200, 105, 118, 1, 82, 0, 13, 0, 121, 0, 11, 0, 82, 6, 0, 0, 106, 6, 6, 16, 1, 10, 255, 3, 19, 6, 6, 10, 135, 13, 235, 0, 6, 0, 0, 0, 2, 13, 0, 0, 200, 105, 118, 1, 1, 6, 0, 0, 85, 13, 6, 0, 2, 6, 0, 0, 60, 105, 118, 1, 1, 13, 0, 0, 83, 6, 13, 0, 1, 13, 1, 0, 83, 5, 13, 0, 1, 6, 0, 0, 135, 13, 47, 1, 6, 0, 0, 0, 1, 6, 1, 0, 135, 13, 48, 1, 6, 0, 0, 0, 2, 13, 0, 0, 60, 105, 118, 1, 78, 13, 13, 0, 120, 13, 17, 0, 78, 13, 5, 0, 120, 13, 7, 0, 2, 6, 0, 0, 52, 105, 118, 1, 82, 6, 6, 0, 135, 13, 140, 0, 6, 0, 0, 0, 119, 0, 4, 0, 1, 13, 0, 0, 83, 5, 13, 0, 135, 13, 49, 1, 135, 13, 50, 1, 1, 6, 1, 0, 135, 13, 51, 1, 6, 0, 0, 0, 119, 0, 237, 255, 2, 6, 0, 0, 56, 105, 118, 1, 82, 6, 6, 0, 135, 13, 131, 0, 6, 0, 0, 0, 1, 6, 0, 0, 135, 13, 48, 1, 6, 0, 0, 0, 121, 2, 2, 0, 135, 13, 122, 0, 135, 13, 120, 0, 1, 0, 0, 0, 135, 13, 52, 1, 137, 3, 0, 0, 139, 0, 0, 0, 140, 0, 11, 0, 0, 0, 0, 0, 2, 6, 0, 0, 226, 238, 113, 0, 2, 7, 0, 0, 227, 238, 113, 0, 2, 8, 0, 0, 124, 202, 2, 0, 82, 8, 8, 0, 2, 9, 0, 0, 184, 69, 118, 1, 82, 9, 9, 0, 3, 0, 8, 9, 2, 9, 0, 0, 124, 202, 2, 0, 85, 9, 0, 0, 2, 9, 0, 0, 184, 69, 118, 1, 1, 8, 0, 0, 85, 9, 8, 0, 34, 8, 0, 1, 121, 8, 3, 0, 1, 0, 0, 0, 119, 0, 98, 0, 2, 8, 0, 0, 128, 202, 2, 0, 82, 8, 8, 0, 4, 5, 8, 0, 2, 8, 0, 0, 134, 46, 203, 1, 1, 9, 1, 0, 83, 8, 9, 0, 76, 9, 5, 0, 145, 3, 9, 0, 2, 9, 0, 0, 140, 187, 199, 1, 82, 0, 9, 0, 120, 0, 3, 0, 1, 5, 7, 0, 119, 0, 36, 0, 88, 2, 0, 0, 145, 2, 2, 0, 2, 8, 0, 0, 128, 202, 2, 0, 82, 9, 8, 0, 76, 9, 9, 0, 145, 9, 9, 0, 65, 4, 2, 9, 145, 4, 4, 0, 72, 9, 4, 3, 120, 9, 3, 0, 1, 5, 6, 0, 119, 0, 23, 0, 25, 5, 0, 12, 2, 9, 0, 0, 140, 187, 199, 1, 82, 8, 5, 0, 85, 9, 8, 0, 2, 8, 0, 0, 144, 187, 199, 1, 89, 8, 2, 0, 106, 9, 0, 8, 1, 10, 255, 3, 19, 9, 9, 10, 106, 10, 0, 4, 135, 8, 235, 0, 9, 10, 0, 0, 2, 8, 0, 0, 136, 187, 199, 1, 82, 8, 8, 0, 85, 5, 8, 0, 2, 8, 0, 0, 136, 187, 199, 1, 85, 8, 0, 0, 119, 0, 216, 255, 32, 8, 5, 6, 121, 8, 20, 0, 2, 8, 0, 0, 134, 46, 203, 1, 1, 9, 0, 0, 83, 8, 9, 0, 64, 9, 4, 3, 145, 9, 9, 0, 75, 5, 9, 0, 32, 9, 5, 0, 1, 8, 1, 0, 125, 5, 9, 8, 5, 0, 0, 0, 2, 8, 0, 0, 124, 202, 2, 0, 82, 1, 8, 0, 0, 0, 1, 0, 15, 8, 5, 1, 125, 1, 8, 5, 1, 0, 0, 0, 119, 0, 11, 0, 32, 8, 5, 7, 121, 8, 9, 0, 2, 8, 0, 0, 134, 46, 203, 1, 1, 9, 0, 0, 83, 8, 9, 0, 2, 9, 0, 0, 124, 202, 2, 0, 82, 1, 9, 0, 0, 0, 1, 0, 2, 9, 0, 0, 184, 69, 118, 1, 85, 9, 1, 0, 2, 9, 0, 0, 124, 202, 2, 0, 4, 8, 0, 1, 85, 9, 8, 0, 2, 8, 0, 0, 132, 155, 199, 1, 82, 8, 8, 0, 120, 8, 3, 0, 1, 0, 1, 0, 119, 0, 3, 0, 135, 8, 53, 1, 1, 0, 1, 0, 139, 0, 0, 0, 140, 0, 6, 0, 0, 0, 0, 0, 2, 1, 0, 0, 198, 15, 13, 0, 2, 2, 0, 0, 255, 0, 0, 0, 2, 3, 0, 0, 208, 138, 4, 0, 135, 4, 54, 1, 121, 4, 3, 0, 1, 0, 0, 0, 119, 0, 84, 0, 2, 4, 0, 0, 128, 9, 51, 0, 78, 4, 4, 0, 120, 4, 14, 0, 2, 5, 0, 0, 128, 9, 51, 0, 135, 4, 55, 1, 5, 0, 0, 0, 121, 4, 9, 0, 135, 0, 135, 0, 2, 4, 0, 0, 40, 63, 52, 0, 85, 4, 0, 0, 2, 5, 0, 0, 128, 9, 51, 0, 135, 4, 56, 1, 5, 0, 0, 0, 2, 4, 0, 0, 20, 63, 52, 0, 82, 4, 4, 0, 120, 4, 19, 0, 135, 0, 135, 0, 1, 4, 16, 0, 2, 5, 0, 0, 40, 63, 52, 0, 82, 5, 5, 0, 4, 5, 0, 5, 48, 4, 4, 5, 136, 53, 1, 0, 1, 5, 4, 0, 135, 4, 195, 0, 5, 0, 0, 0, 1, 5, 0, 0, 135, 4, 137, 0, 5, 0, 0, 0, 135, 0, 135, 0, 2, 4, 0, 0, 40, 63, 52, 0, 85, 4, 0, 0, 134, 4, 0, 0, 212, 50, 1, 0, 121, 4, 24, 0, 2, 4, 0, 0, 196, 69, 118, 1, 82, 4, 4, 0, 19, 4, 4, 2, 135, 0, 57, 1, 4, 0, 0, 0, 34, 4, 0, 0, 121, 4, 3, 0, 1, 0, 1, 0, 119, 0, 32, 0, 121, 0, 243, 255, 1, 4, 127, 0, 47, 4, 4, 0, 212, 53, 1, 0, 1, 0, 0, 0, 119, 0, 26, 0, 41, 4, 0, 2, 94, 4, 3, 4, 19, 4, 4, 2, 135, 0, 57, 1, 4, 0, 0, 0, 121, 0, 232, 255, 119, 0, 19, 0, 135, 4, 58, 1, 2, 4, 0, 0, 24, 63, 52, 0, 82, 4, 4, 0, 120, 4, 2, 0, 119, 0, 10, 0, 135, 4, 59, 1, 2, 4, 0, 0, 24, 63, 52, 0, 2, 5, 0, 0, 24, 63, 52, 0, 82, 5, 5, 0, 26, 5, 5, 1, 85, 4, 5, 0, 119, 0, 216, 255, 134, 5, 0, 0, 244, 15, 1, 0, 1, 0, 0, 0, 139, 0, 0, 0, 140, 0, 10, 0, 0, 0, 0, 0, 136, 5, 0, 0, 0, 1, 5, 0, 136, 5, 0, 0, 25, 5, 5, 16, 137, 5, 0, 0, 2, 5, 0, 0, 200, 68, 118, 1, 1, 6, 0, 0, 84, 5, 6, 0, 1, 5, 16, 0, 134, 6, 0, 0, 28, 73, 1, 0, 5, 0, 0, 0, 2, 6, 0, 0, 201, 68, 118, 1, 1, 5, 14, 0, 83, 6, 5, 0, 2, 5, 0, 0, 212, 68, 118, 1, 1, 6, 0, 0, 84, 5, 6, 0, 1, 0, 0, 0, 32, 6, 0, 36, 120, 6, 13, 0, 2, 6, 0, 0, 200, 68, 118, 1, 2, 5, 0, 0, 165, 154, 3, 0, 90, 5, 5, 0, 83, 6, 5, 0, 1, 6, 16, 0, 134, 5, 0, 0, 28, 73, 1, 0, 6, 0, 0, 0, 25, 0, 0, 1, 119, 0, 243, 255, 2, 6, 0, 0, 165, 154, 3, 0, 135, 5, 45, 0, 6, 1, 0, 0, 2, 5, 0, 0, 128, 155, 199, 1, 82, 0, 5, 0, 2, 5, 0, 0, 128, 202, 2, 0, 82, 1, 5, 0, 2, 5, 0, 0, 124, 202, 2, 0, 82, 2, 5, 0, 2, 5, 0, 0, 184, 69, 118, 1, 82, 3, 5, 0, 77, 5, 0, 0, 4, 8, 1, 2, 4, 7, 8, 3, 76, 7, 7, 0, 145, 7, 7, 0, 76, 9, 1, 0, 145, 8, 9, 0, 66, 6, 7, 8, 145, 6, 6, 0, 63, 4, 5, 6, 77, 6, 0, 0, 4, 7, 1, 2, 4, 8, 7, 3, 76, 8, 8, 0, 145, 8, 8, 0, 76, 9, 1, 0, 145, 7, 9, 0, 66, 5, 8, 7, 145, 5, 5, 0, 63, 6, 6, 5, 64, 6, 6, 4, 59, 5, 184, 11, 71, 6, 6, 5, 120, 6, 2, 0, 119, 0, 16, 0, 134, 6, 0, 0, 252, 69, 1, 0, 2, 6, 0, 0, 128, 155, 199, 1, 82, 0, 6, 0, 2, 6, 0, 0, 128, 202, 2, 0, 82, 1, 6, 0, 2, 6, 0, 0, 124, 202, 2, 0, 82, 2, 6, 0, 2, 6, 0, 0, 184, 69, 118, 1, 82, 3, 6, 0, 119, 0, 227, 255, 1, 6, 4, 0, 135, 3, 60, 1, 6, 0, 0, 0, 1, 6, 1, 0, 85, 3, 6, 0, 2, 5, 0, 0, 208, 196, 2, 0, 1, 7, 0, 0, 135, 6, 61, 1, 3, 5, 7, 0, 1, 6, 0, 0, 139, 6, 0, 0, 140, 0, 11, 0, 0, 0, 0, 0, 136, 8, 0, 0, 0, 6, 8, 0, 136, 8, 0, 0, 25, 8, 8, 16, 137, 8, 0, 0, 0, 5, 6, 0, 25, 0, 6, 8, 25, 4, 6, 4, 2, 9, 0, 0, 136, 72, 118, 1, 135, 8, 0, 0, 9, 0, 0, 0, 2, 9, 0, 0, 255, 255, 0, 0, 19, 8, 8, 9, 41, 8, 8, 4, 1, 9, 19, 1, 3, 1, 8, 9, 1, 2, 1, 0, 0, 3, 0, 0, 120, 2, 2, 0, 119, 0, 8, 0, 135, 7, 15, 0, 1, 0, 0, 0, 83, 3, 7, 0, 25, 1, 1, 1, 26, 2, 2, 1, 25, 3, 3, 1, 119, 0, 248, 255, 79, 1, 0, 0, 2, 9, 0, 0, 4, 41, 203, 1, 82, 0, 9, 0, 2, 9, 0, 0, 8, 41, 203, 1, 82, 9, 9, 0, 4, 9, 9, 0, 42, 9, 9, 2, 48, 9, 9, 1, 156, 56, 1, 0, 2, 8, 0, 0, 115, 70, 4, 0, 135, 9, 11, 0, 8, 5, 0, 0, 41, 8, 1, 2, 94, 8, 0, 8, 1, 10, 255, 3, 19, 8, 8, 10, 135, 9, 235, 0, 8, 4, 0, 0, 82, 0, 4, 0, 82, 8, 0, 0, 106, 8, 8, 8, 1, 10, 255, 3, 19, 8, 8, 10, 135, 9, 235, 0, 8, 0, 0, 0, 82, 0, 4, 0, 121, 0, 7, 0, 82, 8, 0, 0, 106, 8, 8, 4, 1, 10, 255, 3, 19, 8, 8, 10, 135, 9, 235, 0, 8, 0, 0, 0, 137, 6, 0, 0, 1, 9, 0, 0, 139, 9, 0, 0, 140, 2, 10, 0, 0, 0, 0, 0, 136, 7, 0, 0, 0, 6, 7, 0, 136, 7, 0, 0, 25, 7, 7, 48, 137, 7, 0, 0, 25, 3, 6, 32, 25, 5, 6, 24, 25, 4, 6, 16, 25, 2, 6, 36, 2, 8, 0, 0, 143, 1, 4, 0, 135, 7, 171, 0, 1, 8, 0, 0, 121, 7, 29, 0, 2, 9, 0, 0, 148, 0, 4, 0, 135, 8, 146, 0, 9, 0, 0, 0, 135, 7, 147, 0, 0, 8, 6, 0, 2, 7, 0, 0, 213, 3, 4, 0, 135, 1, 146, 0, 7, 0, 0, 0, 2, 8, 0, 0, 164, 72, 4, 0, 25, 9, 6, 8, 135, 7, 147, 0, 0, 8, 9, 0, 2, 9, 0, 0, 140, 73, 4, 0, 135, 7, 106, 0, 9, 1, 0, 0, 120, 7, 6, 0, 2, 9, 0, 0, 239, 3, 4, 0, 135, 7, 147, 0, 0, 9, 5, 0, 119, 0, 24, 0, 135, 7, 147, 0, 0, 1, 4, 0, 119, 0, 21, 0, 2, 8, 0, 0, 246, 3, 4, 0, 135, 9, 146, 0, 8, 0, 0, 0, 135, 7, 147, 0, 0, 9, 3, 0, 1, 7, 1, 0, 84, 2, 7, 0, 1, 9, 0, 0, 1, 8, 0, 0, 134, 7, 0, 0, 4, 58, 1, 0, 9, 3, 2, 8, 78, 7, 3, 0, 120, 7, 6, 0, 1, 8, 0, 0, 1, 9, 0, 0, 134, 7, 0, 0, 4, 58, 1, 0, 8, 3, 2, 9, 137, 6, 0, 0, 139, 0, 0, 0, 140, 4, 9, 0, 0, 0, 0, 0, 136, 6, 0, 0, 0, 5, 6, 0, 136, 6, 0, 0, 25, 6, 6, 16, 137, 6, 0, 0, 0, 4, 5, 0, 121, 3, 6, 0, 2, 6, 0, 0, 255, 255, 0, 0, 19, 6, 0, 6, 0, 0, 6, 0, 119, 0, 12, 0, 2, 8, 0, 0, 136, 72, 118, 1, 135, 7, 0, 0, 8, 0, 0, 0, 135, 6, 1, 0, 4, 7, 0, 0, 135, 6, 17, 0, 4, 0, 0, 0, 1, 7, 255, 0, 19, 6, 6, 7, 0, 0, 6, 0, 1, 6, 126, 0, 48, 6, 6, 0, 136, 58, 1, 0, 1, 7, 6, 0, 135, 6, 85, 0, 7, 0, 0, 0, 1, 0, 0, 0, 119, 0, 29, 0, 2, 6, 0, 0, 96, 213, 8, 0, 41, 7, 0, 2, 3, 3, 6, 7, 82, 0, 3, 0, 121, 0, 19, 0, 82, 6, 0, 0, 106, 6, 6, 36, 1, 8, 255, 0, 19, 6, 6, 8, 135, 7, 62, 1, 6, 0, 0, 0, 121, 7, 12, 0, 80, 7, 2, 0, 84, 4, 7, 0, 82, 0, 3, 0, 82, 7, 0, 0, 106, 7, 7, 8, 38, 7, 7, 127, 135, 0, 63, 1, 7, 0, 1, 4, 80, 7, 4, 0, 84, 2, 7, 0, 119, 0, 5, 0, 1, 6, 6, 0, 135, 7, 85, 0, 6, 0, 0, 0, 1, 0, 0, 0, 137, 5, 0, 0, 139, 0, 0, 0, 140, 2, 8, 0, 0, 0, 0, 0, 136, 5, 0, 0, 0, 4, 5, 0, 136, 5, 0, 0, 25, 5, 5, 32, 137, 5, 0, 0, 25, 3, 4, 24, 25, 2, 4, 16, 2, 6, 0, 0, 143, 1, 4, 0, 135, 5, 171, 0, 1, 6, 0, 0, 121, 5, 29, 0, 2, 7, 0, 0, 87, 255, 3, 0, 135, 6, 146, 0, 7, 0, 0, 0, 135, 5, 147, 0, 0, 6, 4, 0, 2, 5, 0, 0, 209, 7, 4, 0, 135, 1, 146, 0, 5, 0, 0, 0, 2, 6, 0, 0, 164, 72, 4, 0, 25, 7, 4, 8, 135, 5, 147, 0, 0, 6, 7, 0, 2, 7, 0, 0, 140, 73, 4, 0, 135, 5, 106, 0, 7, 1, 0, 0, 120, 5, 6, 0, 2, 7, 0, 0, 233, 7, 4, 0, 135, 5, 147, 0, 0, 7, 3, 0, 119, 0, 12, 0, 135, 5, 147, 0, 0, 1, 2, 0, 119, 0, 9, 0, 2, 5, 0, 0, 200, 68, 118, 1, 1, 7, 3, 0, 84, 5, 7, 0, 1, 5, 16, 0, 134, 7, 0, 0, 28, 73, 1, 0, 5, 0, 0, 0, 137, 4, 0, 0, 139, 0, 0, 0, 140, 0, 7, 0, 0, 0, 0, 0, 136, 3, 0, 0, 0, 2, 3, 0, 136, 3, 0, 0, 25, 3, 3, 48, 137, 3, 0, 0, 0, 0, 2, 0, 2, 3, 0, 0, 150, 46, 203, 1, 78, 3, 3, 0, 121, 3, 12, 0, 2, 3, 0, 0, 104, 43, 203, 1, 82, 1, 3, 0, 135, 3, 135, 0, 4, 3, 1, 3, 34, 3, 3, 1, 121, 3, 5, 0, 2, 3, 0, 0, 150, 46, 203, 1, 1, 4, 0, 0, 83, 3, 4, 0, 25, 1, 0, 16, 135, 4, 136, 0, 0, 0, 0, 0, 120, 4, 2, 0, 119, 0, 24, 2, 82, 4, 0, 0, 1, 3, 0, 1, 1, 5, 2, 2, 138, 4, 3, 5, 92, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0], eb + 71680);
  HEAPU8.set([88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 88, 68, 1, 0, 108, 68, 1, 0, 152, 68, 1, 0, 119, 0, 246, 253, 1, 5, 1, 0, 135, 3, 64, 1, 5, 0, 0, 0, 119, 0, 242, 253, 2, 3, 0, 0, 150, 46, 203, 1, 78, 3, 3, 0, 32, 3, 3, 0, 82, 5, 1, 0, 1, 6, 72, 4, 13, 5, 5, 6, 19, 3, 3, 5, 121, 3, 233, 253, 135, 3, 65, 1, 119, 0, 231, 253, 119, 0, 245, 255, 1, 3, 10, 0, 135, 4, 51, 1, 3, 0, 0, 0, 137, 2, 0, 0, 1, 4, 0, 0, 139, 4, 0, 0, 140, 2, 8, 0, 0, 0, 0, 0, 2, 4, 0, 0, 216, 68, 118, 1, 80, 3, 4, 0, 2, 4, 0, 0, 216, 68, 118, 1, 2, 5, 0, 0, 255, 255, 0, 0, 19, 5, 3, 5, 2, 6, 0, 0, 252, 255, 0, 0, 3, 5, 5, 6, 84, 4, 5, 0, 2, 4, 0, 0, 160, 69, 118, 1, 82, 4, 4, 0, 26, 6, 3, 4, 2, 7, 0, 0, 255, 255, 0, 0, 19, 6, 6, 7, 3, 4, 4, 6, 2, 6, 0, 0, 252, 69, 118, 1, 82, 6, 6, 0, 41, 6, 6, 5, 1, 7, 0, 16, 3, 6, 6, 7, 2, 7, 0, 0, 255, 255, 0, 0, 19, 6, 6, 7, 135, 5, 87, 0, 4, 6, 0, 0, 2, 6, 0, 0, 160, 69, 118, 1, 82, 6, 6, 0, 25, 6, 6, 2, 2, 4, 0, 0, 216, 68, 118, 1, 81, 4, 4, 0, 3, 6, 6, 4, 1, 4, 0, 240, 135, 5, 87, 0, 6, 4, 0, 0, 2, 5, 0, 0, 232, 68, 118, 1, 82, 3, 5, 0, 2, 5, 0, 0, 138, 69, 118, 1, 80, 2, 5, 0, 2, 5, 0, 0, 232, 68, 118, 1, 2, 4, 0, 0, 255, 255, 0, 0, 19, 4, 1, 4, 85, 5, 4, 0, 2, 4, 0, 0, 138, 69, 118, 1, 84, 4, 0, 0, 2, 4, 0, 0, 156, 69, 118, 1, 2, 5, 0, 0, 255, 255, 0, 0, 19, 5, 0, 5, 41, 5, 5, 4, 85, 4, 5, 0, 134, 5, 0, 0, 180, 74, 1, 0, 2, 5, 0, 0, 232, 68, 118, 1, 85, 5, 3, 0, 2, 5, 0, 0, 138, 69, 118, 1, 84, 5, 2, 0, 2, 5, 0, 0, 156, 69, 118, 1, 2, 4, 0, 0, 255, 255, 0, 0, 19, 4, 2, 4, 41, 4, 4, 4, 85, 5, 4, 0, 139, 0, 0, 0, 140, 0, 6, 0, 0, 0, 0, 0, 2, 3, 0, 0, 236, 68, 118, 1, 82, 1, 3, 0, 2, 3, 0, 0, 236, 68, 118, 1, 1, 4, 0, 2, 20, 4, 1, 4, 85, 3, 4, 0, 2, 4, 0, 0, 138, 69, 118, 1, 80, 0, 4, 0, 2, 4, 0, 0, 232, 68, 118, 1, 82, 2, 4, 0, 2, 4, 0, 0, 138, 69, 118, 1, 1, 3, 0, 240, 84, 4, 3, 0, 2, 3, 0, 0, 156, 69, 118, 1, 2, 4, 0, 0, 0, 0, 15, 0, 85, 3, 4, 0, 2, 4, 0, 0, 232, 68, 118, 1, 2, 3, 0, 0, 248, 69, 118, 1, 82, 3, 3, 0, 41, 3, 3, 5, 1, 5, 0, 16, 3, 3, 3, 5, 85, 4, 3, 0, 135, 3, 66, 1, 2, 3, 0, 0, 232, 68, 118, 1, 85, 3, 2, 0, 2, 3, 0, 0, 138, 69, 118, 1, 84, 3, 0, 0, 2, 3, 0, 0, 156, 69, 118, 1, 2, 4, 0, 0, 255, 255, 0, 0, 19, 4, 0, 4, 41, 4, 4, 4, 85, 3, 4, 0, 2, 4, 0, 0, 236, 68, 118, 1, 82, 0, 4, 0, 2, 4, 0, 0, 236, 68, 118, 1, 1, 5, 0, 2, 19, 5, 1, 5, 32, 5, 5, 0, 121, 5, 5, 0, 1, 5, 255, 253, 19, 5, 0, 5, 0, 3, 5, 0, 119, 0, 4, 0, 1, 5, 0, 2, 20, 5, 0, 5, 0, 3, 5, 0, 85, 4, 3, 0, 2, 3, 0, 0, 89, 46, 203, 1, 78, 3, 3, 0, 32, 3, 3, 0, 1, 4, 0, 0, 2, 5, 0, 0, 184, 69, 118, 1, 82, 5, 5, 0, 15, 4, 4, 5, 19, 3, 3, 4, 121, 3, 5, 0, 2, 3, 0, 0, 184, 69, 118, 1, 1, 4, 0, 0, 85, 3, 4, 0, 139, 0, 0, 0, 140, 2, 6, 0, 0, 0, 0, 0, 136, 5, 0, 0, 0, 4, 5, 0, 136, 5, 0, 0, 25, 5, 5, 16, 137, 5, 0, 0, 0, 3, 4, 0, 2, 5, 0, 0, 116, 72, 118, 1, 82, 2, 5, 0, 120, 2, 3, 0, 1, 2, 255, 0, 119, 0, 20, 0, 1, 5, 0, 0, 85, 3, 5, 0, 134, 2, 0, 0, 228, 36, 1, 0, 2, 0, 3, 1, 82, 3, 3, 0, 0, 0, 3, 0, 121, 3, 12, 0, 2, 5, 0, 0, 116, 72, 118, 1, 82, 1, 5, 0, 121, 1, 5, 0, 135, 5, 37, 1, 1, 0, 0, 0, 135, 5, 154, 0, 1, 0, 0, 0, 2, 5, 0, 0, 116, 72, 118, 1, 85, 5, 0, 0, 137, 4, 0, 0, 139, 2, 0, 0, 140, 3, 5, 0, 0, 0, 0, 0, 1, 4, 172, 17, 135, 3, 155, 0, 4, 0, 0, 0, 135, 4, 34, 1, 3, 0, 0, 0, 135, 0, 36, 1, 3, 0, 1, 0, 120, 0, 16, 0, 1, 4, 0, 0, 134, 0, 0, 0, 164, 104, 0, 0, 4, 2, 1, 0, 120, 0, 6, 0, 2, 4, 0, 0, 116, 72, 118, 1, 85, 4, 3, 0, 1, 0, 0, 0, 119, 0, 10, 0, 135, 4, 37, 1, 3, 0, 0, 0, 135, 4, 154, 0, 3, 0, 0, 0, 119, 0, 5, 0, 135, 4, 37, 1, 3, 0, 0, 0, 135, 4, 154, 0, 3, 0, 0, 0, 139, 0, 0, 0, 140, 2, 9, 0, 0, 0, 0, 0, 1, 5, 0, 0, 25, 4, 0, 4, 25, 2, 0, 8, 82, 2, 2, 0, 0, 3, 2, 0, 52, 6, 4, 3, 168, 72, 1, 0, 121, 1, 3, 0, 1, 5, 6, 0, 119, 0, 4, 0, 102, 6, 2, 12, 121, 6, 2, 0, 1, 5, 6, 0, 32, 6, 5, 6, 121, 6, 7, 0, 1, 5, 0, 0, 106, 7, 2, 8, 1, 8, 255, 3, 19, 7, 7, 8, 135, 6, 235, 0, 7, 0, 0, 0, 25, 2, 3, 4, 119, 0, 237, 255, 139, 0, 0, 0, 140, 1, 3, 0, 0, 0, 0, 0, 135, 1, 67, 1, 0, 0, 0, 0, 2, 1, 0, 0, 4, 206, 2, 0, 85, 0, 1, 0, 2, 2, 0, 0, 130, 254, 3, 0, 135, 1, 68, 1, 0, 2, 0, 0, 1, 2, 0, 0, 107, 0, 36, 2, 1, 1, 0, 0, 107, 0, 37, 1, 1, 2, 0, 0, 107, 0, 40, 2, 1, 1, 7, 0, 107, 0, 41, 1, 1, 2, 0, 0, 107, 0, 54, 2, 1, 1, 0, 0, 107, 0, 53, 1, 1, 2, 0, 0, 107, 0, 55, 2, 135, 2, 69, 1, 0, 0, 0, 0, 139, 0, 0, 0, 140, 1, 6, 0, 0, 0, 0, 0, 2, 3, 0, 0, 232, 68, 118, 1, 82, 2, 3, 0, 2, 3, 0, 0, 138, 69, 118, 1, 80, 1, 3, 0, 2, 3, 0, 0, 232, 68, 118, 1, 1, 4, 255, 0, 19, 4, 0, 4, 27, 4, 4, 6, 1, 5, 0, 32, 20, 4, 4, 5, 85, 3, 4, 0, 2, 4, 0, 0, 138, 69, 118, 1, 1, 3, 0, 240, 84, 4, 3, 0, 2, 3, 0, 0, 156, 69, 118, 1, 2, 4, 0, 0, 0, 0, 15, 0, 85, 3, 4, 0, 134, 4, 0, 0, 180, 74, 1, 0, 2, 4, 0, 0, 232, 68, 118, 1, 85, 4, 2, 0, 2, 4, 0, 0, 138, 69, 118, 1, 84, 4, 1, 0, 2, 4, 0, 0, 156, 69, 118, 1, 2, 3, 0, 0, 255, 255, 0, 0, 19, 3, 1, 3, 41, 3, 3, 4, 85, 4, 3, 0, 139, 0, 0, 0, 140, 1, 6, 0, 0, 0, 0, 0, 25, 2, 0, 4, 25, 0, 0, 8, 82, 1, 0, 0, 0, 0, 1, 0, 52, 3, 2, 0, 252, 73, 1, 0, 106, 4, 1, 8, 1, 5, 1, 0, 134, 3, 0, 0, 68, 72, 1, 0, 4, 5, 0, 0, 25, 0, 0, 4, 119, 0, 246, 255, 139, 0, 0, 0, 140, 3, 5, 0, 0, 0, 0, 0, 2, 3, 0, 0, 0, 211, 7, 0, 106, 4, 0, 32, 41, 4, 4, 2, 94, 0, 3, 4, 82, 4, 0, 0, 106, 4, 4, 8, 38, 4, 4, 127, 135, 3, 63, 1, 4, 0, 1, 2, 139, 3, 0, 0, 140, 1, 5, 0, 0, 0, 0, 0, 1, 2, 8, 0, 135, 1, 155, 0, 2, 0, 0, 0, 134, 2, 0, 0, 108, 47, 1, 0, 1, 0, 0, 0, 2, 2, 0, 0, 120, 72, 118, 1, 85, 2, 1, 0, 1, 3, 37, 3, 1, 4, 1, 0, 135, 2, 109, 0, 0, 3, 4, 0, 139, 0, 0, 0, 140, 1, 2, 0, 0, 0, 0, 0, 135, 1, 70, 1, 135, 1, 71, 1, 134, 1, 0, 0, 220, 48, 1, 0, 139, 0, 0, 0, 140, 1, 3, 0, 0, 0, 0, 0, 1, 2, 1, 0, 107, 0, 21, 2, 106, 1, 0, 16, 38, 1, 1, 63, 135, 2, 72, 1, 1, 0, 0, 0, 139, 0, 0, 0, 140, 0, 3, 0, 0, 0, 0, 0, 135, 0, 135, 0, 2, 1, 0, 0, 36, 63, 52, 0, 82, 1, 1, 0, 1, 2, 255, 0, 19, 1, 1, 2, 135, 0, 57, 1, 1, 0, 0, 0, 121, 0, 249, 255, 139, 0, 0, 0, 0, 0, 0, 0], eb + 81920);
  var relocations = [];
  relocations = relocations.concat([512, 516, 520, 524, 528, 532, 536, 540, 544, 548, 552, 556, 560, 564, 568, 572, 576, 580, 584, 588, 592, 760, 764, 768, 772, 776, 780, 784, 788, 792, 796, 800, 804, 808, 812, 816, 820, 824, 828, 832, 836, 840, 844, 848, 852, 856, 860, 864, 868, 872, 876, 880, 884, 888, 892, 896, 900, 904, 908, 912, 916, 920, 924, 928, 932, 936, 940, 944, 948, 952, 956, 960, 964, 968, 972, 976, 980, 984, 988, 992, 996, 1e3, 1004, 1008, 1012, 1016, 1020, 1024, 1028, 1032, 1036, 1040, 1044, 1048, 1052, 1056, 1060, 1064, 1068, 1072, 1076, 1080, 1084, 1088, 1092, 1096, 1100, 1104, 1108, 1112, 1116, 1120, 1124, 1128, 1132, 1136, 1140, 1144, 1148, 1152, 1156, 1160, 1164, 1168, 1172, 1176, 1180, 1184, 1188, 1192, 1196, 1200, 1204, 1208, 1212, 2308, 2312, 2316, 2840, 2844, 2848, 2852, 2856, 2860, 2864, 2868, 2872, 2876, 5176, 5220, 5296, 6060, 6064, 6280, 6284, 6288, 6292, 6296, 6300, 6304, 6924, 6928, 6932, 6936, 8556, 8560, 10344, 10348, 10532, 10536, 10540, 10544, 11932, 11936, 11940, 11944, 11948, 11952, 11956, 11960, 11964, 11968, 11972, 11976, 11980, 11984, 11988, 11992, 11996, 12e3, 12004, 12008, 12012, 12016, 12020, 12024, 12028, 12032, 12036, 12040, 12044, 12048, 12052, 12056, 12060, 12064, 12160, 12220, 12260, 12776, 12848, 13220, 13224, 13956, 13960, 13964, 13968, 13972, 13976, 13980, 13984, 13988, 13992, 13996, 14e3, 14004, 14008, 14012, 14016, 14020, 14024, 14028, 14032, 14036, 14040, 14044, 14048, 14052, 14056, 14060, 14064, 14088, 14152, 14232, 14320, 14324, 14328, 14332, 14336, 14340, 14344, 14348, 14352, 14356, 14360, 14364, 14368, 14372, 14376, 14380, 14384, 14388, 14392, 14396, 14400, 14404, 14408, 14412, 14416, 14420, 14424, 14428, 14432, 14436, 14440, 14444, 14448, 14452, 14456, 14460, 14464, 14468, 14472, 14476, 14480, 14484, 14488, 14492, 14496, 14500, 14504, 14508, 14512, 14516, 14520, 14524, 14528, 14532, 14536, 14540, 14544, 14548, 14552, 14556, 14560, 14564, 14568, 14572, 14576, 14580, 14584, 14588, 14592, 14740, 14972, 15044, 15608, 15664, 15736, 15764, 16008, 16100, 16268, 16632, 16660, 16676, 17212, 17304, 17396, 18528, 18644, 18744, 18844, 18944, 19044, 19180, 19296, 19412, 19528, 19644, 20948, 21264, 21380, 21572, 21728, 21772, 21864, 21896, 22060, 22996, 23092, 23184, 23276, 23396, 23504, 23912, 23916, 23920, 23924, 24360, 24536, 24668, 24704, 24788, 25e3, 25044, 25112, 25196, 25348, 25368, 25560, 25700, 25764, 25876, 26060, 26144, 26376, 26996, 27036, 27052, 27056, 27060, 27064, 27068, 27072, 27076, 27080, 27084, 27088, 27092, 27096, 27100, 27104, 27108, 27112, 27116, 27120, 27124, 27128, 27132, 27136, 27140, 27144, 27148, 27152, 27156, 27160, 27164, 27168, 27172, 27176, 27180, 27184, 27188, 27192, 27196, 27200, 27204, 27208, 27212, 27216, 27220, 27224, 27228, 27232, 27236, 27240, 27244, 27248, 27252, 27256, 27260, 27264, 27268, 27272, 27276, 27280, 27284, 27288, 27292, 27296, 27300, 27304, 27308, 27312, 27316, 27320, 27324, 27328, 27332, 27336, 27340, 27344, 27348, 27352, 27356, 27360, 27364, 27368, 27372, 27376, 27380, 27384, 27388, 27392, 27396, 27400, 27404, 27408, 27412, 27416, 27420, 27424, 27428, 27432, 27436, 27440, 27444, 27448, 27452, 27456, 27460, 27464, 27468, 27472, 27476, 27480, 27484, 27488, 27492, 27496, 27500, 27504, 27508, 27512, 27516, 27520, 27524, 27528, 27532, 27536, 27540, 27544, 27548, 27552, 27556, 27560, 27564, 27568, 27572, 27576, 27580, 27584, 27588, 27592, 27596, 27600, 27604, 27608, 27612, 27616, 27620, 27624, 27628, 27632, 27636, 27640, 27644, 27648, 27652, 27656, 27660, 27664, 27668, 27672, 27676, 27680, 27684, 27688, 27692, 27696, 27700, 27704, 27708, 27712, 27716, 27720, 27724, 27728, 27732, 27736, 27740, 27744, 27748, 27752, 27756, 27760, 27764, 27768, 27772, 27776, 27780, 27784, 27788, 27792, 27796, 27800, 27804, 27808, 27812, 27816, 27820, 27824, 27828, 27832, 27836, 27840, 27844, 27848, 27852, 27856, 27860, 27864, 27868, 27872, 27876, 27880, 27884, 27888, 27892, 27896, 27900, 27904, 27908, 27912, 27916, 27920, 27924, 27928, 27932, 27936, 27940, 27944, 27948, 27952, 27956, 27960, 27964, 27968, 27972, 27976, 27980, 27984, 27988, 27992, 27996, 28e3, 28004, 28008, 28012, 28016, 28020, 28024, 28028, 28032, 28036, 28040, 28044, 28048, 28052, 28056, 28060, 28064, 28068, 28072, 28076, 28080, 28084, 28088, 28092, 28096, 28100, 28104, 28108, 28112, 28116, 28120, 28124, 28128, 28132, 28136, 28140, 28144, 28148, 28152, 28156, 28160, 28164, 28168, 28172, 28176, 28180, 28184, 28188, 28192, 28196, 28200, 28204, 28208, 28212, 28216, 28220, 28224, 28228, 28232, 28236, 28240, 28244, 28248, 28252, 28256, 28260, 28264, 28268, 28272, 28276, 28280, 28284, 28288, 28292, 28296, 28300, 28304, 28308, 28312, 28316, 28320, 28324, 28328, 28332, 28336, 28340, 28344, 28348, 28352, 28356, 28360, 28364, 28368, 28372, 28376, 28380, 28384, 28388, 28392, 28396, 28400, 28404, 28408, 28412, 28416, 28420, 28424, 28428, 28432, 28436, 28440, 28444, 28448, 28452, 28456, 28460, 28464, 28468, 28472, 28476, 28480, 28484, 28488, 28492, 28496, 28500, 28504, 28508, 28512, 28516, 28520, 28524, 28528, 28532, 28536, 28540, 28544, 28548, 28552, 28556, 28560, 28564, 28568, 28572, 28576, 28580, 28584, 28588, 28592, 28596, 28600, 28604, 28608, 28612, 28616, 28620, 28624, 28628, 28632, 28636, 28640, 28644, 28648, 28652, 28656, 28660, 28664, 28668, 28672, 28676, 28680, 28684, 28688, 28692, 28696, 28700, 28704, 28708, 28712, 28716, 28720, 28724, 28728, 28732, 28736, 28740, 28744, 28748, 28752, 28756, 28760, 28764, 28768, 28772, 28776, 28780, 28784, 28788, 28792, 28796, 28800, 28804, 28808, 28812, 28816, 28820, 28824, 28828, 28832, 28836, 28840, 28844, 28848, 28852, 28856, 28860, 28864, 28868, 28872, 28876, 28880, 28884, 28888, 28892, 28896, 28900, 28904, 28908, 28912, 28916, 28920, 28924, 28928, 28932, 28936, 28940, 28944, 28948, 28952, 28956, 28960, 28964, 28968, 28972, 28976, 28980, 28984, 28988, 28992, 28996, 29e3, 29004, 29008, 29012, 29016, 29020, 29024, 29028, 29032, 29036, 29040, 29044, 29048, 29052, 29056, 29060, 29064, 29068, 29072, 29076, 29080, 29084, 29088, 29092, 29096, 29100, 29104, 29108, 29112, 29116, 29120, 29124, 29128, 29132, 29136, 29140, 29144, 29148, 29152, 29156, 29160, 29164, 29168, 29172, 29176, 29180, 29184, 29188, 29192, 29196, 29200, 29204, 29208, 29212, 29216, 29220, 29224, 29228, 29232, 29236, 29240, 29244, 29248, 29252, 29256, 29260, 29264, 29268, 29272, 29276, 29280, 29284, 29288, 29292, 29296, 29300, 29304, 29308, 29312, 29316, 29320, 29324, 29328, 29332, 29336, 29340, 29344, 29348, 29352, 29356, 29360, 29364, 29368, 29372, 29376, 29380, 29384, 29388, 29392, 29396, 29400, 29404, 29408, 29412, 29416, 29420, 29424, 29428, 29432, 29436, 29440, 29444, 29448, 29452, 29456, 29460, 29464, 29468, 29472, 29476, 29480, 29484, 29488, 29492, 29496, 29500, 29504, 29508, 29512, 29516, 29520, 29524, 29528, 29532, 29536, 29540, 29544, 29548, 29552, 29556, 29560, 29564, 29568, 29572, 29576, 29580, 29584, 29588, 29592, 29596, 29600, 29604, 29608, 29612, 29616, 29620, 29624, 29628, 29632, 29636, 29640, 29644, 29648, 29652, 29656, 29660, 29664, 29668, 29672, 29676, 29680, 29684, 29688, 29692, 29696, 29700, 29704, 29708, 29712, 29716, 29720, 29724, 29728, 29732, 29736, 29740, 29744, 29748, 29752, 29756, 29760, 29764, 29768, 29772, 29776, 29780, 29784, 29788, 29792, 29796, 29800, 29804, 29808, 29812, 29816, 29820, 29824, 29828, 29832, 29836, 29840, 29844, 29848, 29852, 29856, 29860, 29864, 29868, 29872, 29876, 29880, 29884, 29888, 29892, 29896, 29900, 29904, 29908, 29912, 29916, 29920, 29924, 29928, 29932, 29936, 29940, 29944, 29948, 29952, 29956, 29960, 29964, 29968, 29972, 29976, 29980, 29984, 29988, 29992, 29996, 3e4, 30004, 30008, 30012, 30016, 30020, 30024, 30028, 30032, 30140, 30240, 30256, 30260, 30264, 30268, 30272, 30276, 30280, 30284, 30288, 30292, 30296, 30300, 30304, 30308, 30312, 30316, 30320, 30324, 30328, 30332, 30336, 30340, 30344, 30348, 30352, 30356, 30360, 30364, 30368, 30372, 30376, 30380, 30384, 30388, 30392, 30396, 30400, 30404, 30408, 30412, 30416, 30420, 30424, 30428, 30432, 30436, 30440, 30444, 30448, 30452, 30456, 30460, 30464, 30468, 30472, 30476, 30480, 30484, 30488, 30492, 30496, 30500, 30504, 30508, 30512, 30516, 30520, 30524, 30528, 30532, 30536, 30540, 30544, 30548, 30552, 30556, 30560, 30564, 30568, 30572, 30576, 30580, 30584, 30588, 30592, 30596, 30600, 30604, 30608, 30612, 30616, 30620, 30624, 30628, 30632, 30636, 30640, 30644, 30648, 30652, 30656, 30660, 30664, 30668, 30672, 30676, 30680, 30684, 30688, 30692, 30696, 30700, 30704, 30708, 30712, 30716, 30720, 30724, 30728, 30732, 30736, 30740, 30744, 30748, 30752, 30756, 30760, 30764, 30768, 30772, 30776, 30780, 30784, 30788, 30792, 30796, 30800, 30804, 30808, 30812, 30816, 30820, 30824, 30828, 30832, 30836, 30840, 30844, 30848, 30852, 30856, 30860, 30864, 30868, 30872, 30876, 30880, 30884, 30888, 30892, 30896, 30900, 30904, 30908, 30912, 30916, 30920, 30924, 30928, 30932, 30936, 30940, 30944, 30948, 30952, 30956, 30960, 30964, 30968, 30972, 30976, 30980, 30984, 30988, 30992, 30996, 31e3, 31004, 31008, 31012, 31016, 31020, 31024, 31028, 31032, 31036, 31040, 31044, 31048, 31052, 31056, 31060, 31064, 31068, 31072, 31076, 31080, 31084, 31088, 31092, 31096, 31100, 31104, 31108, 31112, 31116, 31120, 31124, 31128, 31132, 31136, 31140, 31144, 31148, 31152, 31156, 31160, 31164, 31168, 31172, 31176, 31180, 31184, 31188, 31192, 31196, 31200, 31204, 31208, 31212, 31216, 31220, 31224, 31228, 31232, 31236, 31240, 31244, 31248, 31252, 31256, 31260, 31264, 31268, 31272, 31276, 31280, 31284, 31400, 31420, 31436, 31452, 31456, 31460, 31464, 31468, 31472, 31476, 31480, 31484, 31488, 31492, 31496, 31500, 31504, 31508, 31556, 31560, 31564, 31568, 31572, 31576, 31580, 31584, 31588, 31592, 31596, 31600, 31604, 31608, 31612, 31616, 31620, 31624, 31628, 31632, 31636, 31640, 31644, 31648, 31652, 31656, 31660, 31664, 31668, 31672, 31676, 31680, 31684, 31688, 31692, 31696, 31700, 31704, 31708, 31712, 31716, 31720, 31724, 31728, 31732, 31736, 31740, 31744, 31748, 31752, 31756, 31760, 31764, 31768, 31772, 31776, 31780, 31784, 31788, 31792, 31796, 31800, 31804, 31808, 31812, 31816, 31820, 31824, 31828, 31832, 31836, 31840, 31844, 31848, 31852, 31856, 31860, 31864, 31868, 31872, 31876, 31880, 31884, 31888, 31892, 31896, 31900, 31904, 31908, 31912, 31916, 31920, 31924, 31928, 31932, 31936, 31940, 31944, 31948, 31952, 31956, 31960, 31964, 31968, 31972, 31976, 31980, 31984, 31988, 31992, 31996, 32e3, 32004, 32008, 32012, 32016, 32020, 32024, 32028, 32032, 32036, 32040, 32044, 32048, 32052, 32056, 32060, 32064, 32068, 32072, 32076, 32080, 32084, 32088, 32092, 32096, 32100, 32104, 32108, 32112, 32116, 32120, 32124, 32128, 32132, 32136, 32140, 32144, 32148, 32152, 32156, 32160, 32164, 32168, 32172, 32176, 32180, 32184, 32188, 32192, 32196, 32200, 32204, 32208, 32212, 32216, 32220, 32224, 32228, 32232, 32236, 32240, 32244, 32248, 32252, 32256, 32260, 32264, 32268, 32272, 32276, 32280, 32284, 32288, 32292, 32296, 32300, 32304, 32308, 32312, 32316, 32320, 32324, 32328, 32332, 32336, 32340, 32344, 32348, 32352, 32356, 32360, 32364, 32368, 32372, 32376, 32380, 32384, 32388, 32392, 32396, 32400, 32404, 32408, 32412, 32416, 32420, 32424, 32428, 32432, 32436, 32440, 32444, 32448, 32452, 32456, 32460, 32464, 32468, 32472, 32476, 32480, 32484, 32488, 32492, 32496, 32500, 32504, 32508, 32512, 32516, 32520, 32524, 32528, 32532, 32536, 32540, 32544, 32548, 32552, 32556, 32560, 32564, 32568, 32572, 32576, 32580, 32584, 32588, 32592, 32596, 32600, 32604, 32608, 32612, 32616, 32620, 32624, 32628, 32632, 32636, 32640, 32644, 32648, 32652, 32656, 32660, 32664, 32668, 32672, 32676, 32680, 32684, 32688, 32692, 32696, 32700, 32704, 32708, 32712, 32716, 32720, 32724, 32728, 32732, 32736, 32740, 32744, 32748, 32752, 32756, 32760, 32764, 32768, 32772, 32776, 32780, 32784, 32788, 32792, 32796, 32800, 32804, 32808, 32812, 32816, 32820, 32824, 32828, 32832, 32836, 32840, 32844, 32848, 32852, 32856, 32860, 32864, 32868, 32872, 32876, 32880, 32884, 32888, 32892, 32896, 32900, 32904, 32908, 32912, 32916, 32920, 32924, 32928, 32932, 32936, 32940, 32944, 32948, 32952, 32956, 32960, 32964, 32968, 32972, 32976, 32980, 32984, 32988, 32992, 32996, 33e3, 33004, 33008, 33012, 33016, 33020, 33024, 33028, 33032, 33036, 33040, 33044, 33048, 33052, 33056, 33060, 33064, 33068, 33072, 33076, 33080, 33084, 33088, 33092, 33096, 33100, 33104, 33108, 33112, 33116, 33120, 33124, 33128, 33132, 33136, 33140, 33144, 33148, 33152, 33156, 33160, 33164, 33168, 33172, 33176, 33180, 33184, 33188, 33192, 33196, 33200, 33204, 33208, 33212, 33216, 33220, 33224, 33228, 33232, 33236, 33240, 33244, 33248, 33252, 33256, 33260, 33264, 33268, 33272, 33316, 33320, 33324, 33328, 33332, 33336, 33340, 33344, 33348, 33352, 33356, 33360, 33364, 33368, 33372, 33376, 33380, 33384, 33388, 33392, 33396, 33400, 33404, 33408, 33412, 33416, 33420, 33424, 33428, 33432, 33436, 33440, 33444, 33448, 33452, 33456, 33460, 33464, 33468, 33472, 33476, 33480, 33484, 33488, 33492, 33496, 33500, 33504, 33508, 33512, 33516, 33520, 33524, 33528, 33532, 33536, 33540, 33544, 33548, 33552, 33556, 33560, 33564, 33568, 33572, 33576, 33580, 33584, 33588, 33592, 33596, 33600, 33604, 33608, 33612, 33616, 33620, 33624, 33628, 33632, 33636, 33640, 33644, 33648, 33652, 33656, 33660, 33664, 33668, 33672, 33676, 33680, 33684, 33688, 33692, 33696, 33700, 33704, 33708, 33712, 33716, 33720, 33724, 33728, 33732, 33736, 33740, 33744, 33748, 33752, 33756, 33760, 33764, 33768, 33772, 33776, 33780, 33784, 33788, 33792, 33796, 33800, 33804, 33808, 33812, 33816, 33820, 33824, 33828, 33832, 33836, 33840, 33844, 33848, 33852, 33856, 33860, 33864, 33868, 33872, 33876, 33880, 33884, 33888, 33892, 33896, 33900, 33904, 33908, 33912, 33916, 33920, 33924, 33928, 33932, 33936, 33940, 33944, 33948, 33952, 33956, 33960, 33964, 33968, 33972, 33976, 33980, 33984, 33988, 33992, 33996, 34e3, 34004, 34008, 34012, 34016, 34020, 34024, 34028, 34032, 34036, 34040, 34044, 34048, 34052, 34056, 34060, 34064, 34068, 34072, 34076, 34080, 34084, 34088, 34092, 34096, 34100, 34104, 34108, 34112, 34116, 34120, 34124, 34128, 34132, 34136, 34140, 34144, 34148, 34152, 34156, 34160, 34164, 34168, 34172, 34176, 34180, 34184, 34188, 34192, 34196, 34200, 34204, 34208, 34212, 34216, 34220, 34224, 34228, 34232, 34236, 34240, 34244, 34248, 34252, 34256, 34260, 34264, 34268, 34272, 34276, 34280, 34284, 34288, 34292, 34296, 34300, 34304, 34308, 34312, 34316, 34320, 34324, 34328, 34332, 34336, 34340, 34344, 34348, 34352, 34356, 34360, 34364, 34368, 34372, 34376, 34380, 34384, 34388, 34392, 34396, 34400, 34404, 34408, 34412, 34416, 34420, 34424, 34428, 34432, 34436, 34440, 34444, 34448, 34452, 34456, 34460, 34464, 34468, 34472, 34476, 34480, 34484, 34488, 34492, 34496, 34500, 34504, 34508, 34512, 34516, 34520, 34524, 34528, 34532, 34536, 34540, 34544, 34548, 34552, 34556, 34560, 34564, 34568, 34572, 34576, 34580, 34584, 34588, 34592, 34596, 34600, 34604, 34608, 34612, 34616, 34620, 34624, 34628, 34632, 34636, 34640, 34644, 34648, 34652, 34656, 34660, 34664, 34668, 34672, 34676, 34680, 34684, 34688, 34692, 34696, 34700, 34704, 34708, 34712, 34716, 34720, 34724, 34728, 34732, 34736, 34740, 34744, 34748, 34752, 34756, 34760, 34764, 34768, 34772, 34776, 34780, 34784, 34788, 34792, 34796, 34800, 34804, 34808, 34812, 34816, 34820, 34824, 34828, 34832, 34836, 34840, 34844, 34848, 34852, 34856, 34860, 34864, 34868, 34872, 34876, 34880, 34884, 34888, 34892, 34896, 34900, 34904, 34908, 34912, 34916, 34920, 34924, 34928, 34932, 34936, 34940, 34944, 34948, 34952, 34956, 34960, 34964, 34968, 34972, 34976, 34980, 34984, 34988, 34992, 34996, 35e3, 35004, 35008, 35012, 35016, 35020, 35024, 35028, 35032, 35036, 35040, 35044, 35048, 35052, 35056, 35060, 35064, 35068, 35072, 35076, 35080, 35084, 35088, 35092, 35096, 35100, 35104, 35108, 35112, 35116, 35120, 35124, 35128, 35132, 35136, 35140, 35144, 35148, 35152, 35156, 35160, 35164, 35168, 35172, 35176, 35180, 35184, 35188, 35192, 35196, 35200, 35204, 35208, 35212, 35216, 35220, 35224, 35228, 35232, 35236, 35240, 35244, 35248, 35252, 35256, 35260, 35264, 35268, 35272, 35276, 35280, 35284, 35288, 35292, 35296, 35300, 35304, 35308, 35312, 35316, 35320, 35324, 35328, 35332, 35336, 35340, 35344, 35348, 35352, 35356, 35360, 35364, 35368, 35372, 35376, 35380, 35384, 35388, 35392, 35396, 35400, 35404, 35408, 35412, 35416, 35420, 35424, 35428, 35432, 35436, 35440, 35444, 35448, 35452, 35456, 35460, 35464, 35468, 35472, 35476, 35480, 35484, 35488, 35492, 35496, 35500, 35504, 35508, 35512, 35516, 35520, 35524, 35528, 35532, 35536, 35540, 35544, 35548, 35552, 35556, 35560, 35564, 35568, 35572, 35576, 35580, 35584, 35588, 35592, 35596, 35600, 35604, 35608, 35612, 35616, 35620, 35624, 35628, 35632, 35636, 35640, 35644, 35648, 35652, 35656, 35660, 35664, 35668, 35672, 35676, 35680, 35684, 35688, 35692, 35696, 35700, 35704, 35708, 35712, 35716, 35720, 35724, 35728, 35732, 35736, 35740, 35744, 35748, 35752, 35756, 35760, 35764, 35768, 35772, 35776, 35780, 35784, 35788, 35792, 35796, 35800, 35804, 35808, 35812, 35816, 35820, 35824, 35828, 35832, 35836, 35840, 35844, 35848, 35852, 35856, 35860, 35864, 35868, 35872, 35876, 35880, 35884, 35888, 35892, 35896, 35900, 35904, 35908, 35912, 35916, 35920, 35924, 35928, 35932, 35936, 35940, 35944, 35948, 35952, 35956, 35960, 35964, 35968, 35972, 35976, 35980, 35984, 35988, 35992, 35996, 36e3, 36004, 36008, 36012, 36016, 36020, 36024, 36028, 36032, 36036, 36040, 36044, 36048, 36052, 36056, 36060, 36064, 36068, 36072, 36076, 36080, 36084, 36088, 36092, 36096, 36100, 36104, 36108, 36112, 36116, 36120, 36124, 36128, 36132, 36136, 36140, 36144, 36148, 36152, 36156, 36160, 36164, 36168, 36172, 36176, 36180, 36184, 36188, 36192, 36196, 36200, 36204, 36208, 36212, 36216, 36220, 36224, 36228, 36232, 36236, 36240, 36244, 36248, 36252, 36256, 36260, 36264, 36268, 36272, 36276, 36280, 36284, 36288, 36292, 36296, 36300, 36304, 36308, 36312, 36316, 36320, 36324, 36328, 36332, 36336, 36340, 36344, 36348, 36352, 36356, 36360, 36364, 36368, 36372, 36376, 36380, 36384, 36388, 36392, 36396, 36400, 36404, 36408, 36412, 36416, 36420, 36424, 36428, 36432, 36436, 36440, 36444, 36448, 36452, 36456, 36460, 36464, 36468, 36472, 36476, 36480, 36484, 36488, 36492, 36496, 36500, 36504, 36508, 36512, 36516, 36520, 36524, 36528, 36532, 36536, 36540, 36544, 36548, 36552, 36556, 36560, 36564, 36568, 36572, 36576, 36580, 36584, 36588, 36592, 36596, 36600, 36604, 36608, 36612, 36616, 36620, 36624, 36628, 36632, 36636, 36640, 36644, 36648, 36652, 36656, 36660, 36664, 36668, 36672, 36676, 36680, 36684, 36688, 36692, 36696, 36700, 36704, 36708, 36712, 36716, 36720, 36724, 36728, 36732, 36736, 36740, 36744, 36748, 36752, 36756, 36760, 36764, 36768, 36772, 36776, 36780, 36784, 36788, 36792, 36796, 36800, 36804, 36808, 36812, 36816, 36820, 36824, 36828, 36832, 36836, 36840, 36844, 36848, 36852, 36856, 36860, 36864, 36868, 36872, 36876, 36880, 36884, 36888, 36892, 36896, 36900, 36904, 36908, 36912, 36916, 36920, 36924, 36928, 36932, 36936, 36940, 36944, 36948, 36952, 36956, 36960, 36964, 36968, 36972, 36976, 36980, 36984, 36988, 36992, 36996, 37e3, 37004, 37008, 37012, 37016, 37020, 37024, 37028, 37032, 37036, 37040, 37044, 37048, 37052, 37056, 37060, 37064, 37068, 37072, 37076, 37080, 37084, 37088, 37092, 37096, 37100, 37104, 37108, 37112, 37116, 37120, 37124, 37128, 37132, 37136, 37140, 37144, 37148, 37152, 37156, 37160, 37164, 37168, 37172, 37176, 37180, 37184, 37188, 37192, 37196, 37200, 37204, 37208, 37212, 37216, 37220, 37224, 37228, 37232, 37236, 37240, 37244, 37248, 37252, 37256, 37260, 37264, 37268, 37272, 37276, 37280, 37284, 37288, 37292, 37296, 37300, 37304, 37308, 37312, 37316, 37320, 37324, 37328, 37332, 37336, 37340, 37344, 37348, 37352, 37356, 37360, 37364, 37368, 37372, 37376, 37380, 37384, 37388, 37392, 37396, 37400, 37404, 37408, 37412, 37416, 37420, 37424, 37428, 37432, 37436, 37440, 37444, 37448, 37452, 37456, 37460, 37464, 37468, 37472, 37476, 37480, 37484, 37488, 37492, 37496, 37500, 37504, 37508, 37512, 37516, 37520, 37524, 37528, 37532, 37536, 37540, 37544, 37548, 37552, 37556, 37560, 37564, 37568, 37572, 37576, 37580, 37584, 37588, 37592, 37596, 37600, 37604, 37608, 37612, 37616, 37620, 37624, 37628, 37632, 37636, 37640, 37644, 37648, 37652, 37656, 37660, 37664, 37668, 37672, 37676, 37680, 37684, 37688, 37692, 37696, 37700, 37704, 37708, 37712, 37716, 37720, 37724, 37728, 37732, 37736, 37740, 37744, 37748, 37752, 37756, 37760, 37764, 37768, 37772, 37776, 37780, 37784, 37788, 37792, 37796, 37800, 37804, 37808, 37812, 37816, 37820, 37824, 37828, 37832, 37836, 37840, 37844, 37848, 37852, 37856, 37860, 37864, 37868, 37872, 37876, 37880, 37884, 37888, 37892, 37896, 37900, 37904, 37908, 37912, 37916, 37920, 37924, 37928, 37932, 37936, 37940, 37944, 37948, 37952, 37956, 37960, 37964, 37968, 37972, 37976, 37980, 37984, 37988, 37992, 37996, 38e3, 38004, 38008, 38012, 38016, 38020, 38024, 38028, 38032, 38036, 38040, 38044, 38048, 38052, 38056, 38060, 38064, 38068, 38072, 38076, 38080, 38084, 38088, 38092, 38096, 38100, 38104, 38108, 38112, 38116, 38120, 38124, 38128, 38132, 38136, 38140, 38144, 38148, 38152, 38156, 38160, 38164, 38168, 38172, 38176, 38180, 38184, 38188, 38192, 38196, 38200, 38204, 38208, 38212, 38216, 38220, 38224, 38228, 38232, 38236, 38240, 38244, 38248, 38252, 38256, 38260, 38264, 38268, 38272, 38276, 38280, 38284, 38288, 38292, 38296, 38300, 38304, 38308, 38312, 38316, 38320, 38324, 38328, 38332, 38336, 38340, 38344, 38348, 38352, 38356, 38360, 38364, 38368, 38372, 38376, 38380, 38384, 38388, 38392, 38396, 38400, 38404, 38408, 38412, 38416, 38420, 38424, 38428, 38432, 38436, 38440, 38444, 38448, 38452, 38456, 38460, 38464, 38468, 38472, 38476, 38480, 38484, 38488, 38492, 38496, 38500, 38504, 38508, 38512, 38516, 38520, 38524, 38528, 38532, 38536, 38540, 38544, 38548, 38552, 38556, 38560, 38564, 38568, 38572, 38576, 38580, 38584, 38588, 38592, 38596, 38600, 38604, 38608, 38612, 38616, 38620, 38624, 38628, 38632, 38636, 38640, 38644, 38648, 38652, 38656, 38660, 38664, 38668, 38672, 38676, 38680, 38684, 38688, 38692, 38696, 38700, 38704, 38708, 38712, 38716, 38720, 38724, 38728, 38732, 38736, 38740, 38744, 38748, 38752, 38756, 38760, 38764, 38768, 38772, 38776, 38780, 38784, 38788, 38792, 38796, 38800, 38804, 38808, 38812, 38816, 38820, 38824, 38828, 38832, 38836, 38840, 38844, 38848, 38852, 38856, 38860, 38864, 38868, 38872, 38876, 38880, 38884, 38888, 38892, 38896, 38900, 38904, 38908, 38912, 38916, 38920, 38924, 38928, 38932, 38936, 38940, 38944, 38948, 38952, 38956, 38960, 38964, 38968, 38972, 38976, 38980, 38984, 38988, 38992, 38996, 39e3, 39004, 39008, 39012, 39016, 39020, 39024, 39028, 39032, 39036, 39040, 39044, 39048, 39052, 39056, 39060, 39064, 39068, 39072, 39076, 39080, 39084, 39088, 39092, 39096, 39100, 39104, 39108, 39112, 39116, 39120, 39124, 39128, 39132, 39136, 39140, 39144, 39148, 39152, 39156, 39160, 39164, 39168, 39172, 39176, 39180, 39184, 39188, 39192, 39196, 39200, 39204, 39208, 39212, 39216, 39220, 39224, 39228, 39232, 39236, 39240, 39244, 39248, 39252, 39256, 39260, 39264, 39268, 39272, 39276, 39280, 39284, 39288, 39292, 39296, 39300, 39304, 39308, 39312, 39316, 39320, 39324, 39328, 39332, 39336, 39340, 39344, 39348, 39352, 39356, 39360, 39364, 39368, 39372, 39376, 39380, 39384, 39388, 39392, 39396, 39400, 39404, 39408, 39412, 39416, 39420, 39424, 39428, 39432, 39436, 39440, 39444, 39448, 39452, 39456, 39460, 39464, 39468, 39472, 39476, 39480, 39484, 39488, 39492, 39496, 39500, 39504, 39508, 39512, 39516, 39520, 39524, 39528, 39532, 39536, 39540, 39544, 39548, 39552, 39556, 39560, 39564, 39568, 39572, 39576, 39580, 39584, 39588, 39592, 39596, 39600, 39604, 39608, 39612, 39616, 39620, 39624, 39628, 39632, 39636, 39640, 39644, 39648, 39652, 39656, 39660, 39664, 39668, 39672, 39676, 39680, 39684, 39688, 39692, 39696, 39700, 39704, 39708, 39712, 39716, 39720, 39724, 39728, 39732, 39736, 39740, 39744, 39748, 39752, 39756, 39760, 39764, 39768, 39772, 39776, 39780, 39784, 39788, 39792, 39796, 39800, 39804, 39808, 39812, 39816, 39820, 39824, 39828, 39832, 39836, 39840, 39844, 39848, 39852, 39856, 39860, 39864, 39868, 39872, 39876, 39880, 39884, 39888, 39892, 39896, 39900, 39904, 39908, 39912, 39916, 39920, 39924, 39928, 39932, 39936, 39940, 39944, 39948, 39952, 39956, 39960, 39964, 39968, 39972, 39976, 39980, 39984, 39988, 39992, 39996, 4e4, 40004, 40008, 40012, 40016, 40020, 40024, 40028, 40032, 40036, 40040, 40044, 40048, 40052, 40056, 40060, 40064, 40068, 40072, 40076, 40080, 40084, 40088, 40092, 40096, 40100, 40104, 40108, 40112, 40116, 40120, 40124, 40128, 40132, 40136, 40140, 40144, 40148, 40152, 40156, 40160, 40164, 40168, 40172, 40176, 40180, 40184, 40188, 40192, 40196, 40200, 40204, 40208, 40212, 40216, 40220, 40224, 40228, 40232, 40236, 40240, 40244, 40248, 40252, 40256, 40260, 40264, 40268, 40272, 40276, 40280, 40284, 40288, 40292, 40296, 40300, 40304, 40308, 40312, 40316, 40320, 40324, 40328, 40332, 40336, 40340, 40344, 40348, 40352, 40356, 40360, 40364, 40368, 40372, 40376, 40380, 40384, 40388, 40392, 40396, 40400, 40404, 40408, 40412, 40416, 40420, 40424, 40428, 40432, 40436, 40440, 40444, 40448, 40452, 40456, 40460, 40464, 40468, 40472, 40476, 40480, 40484, 40488, 40492, 40496, 40500, 40504, 40508, 40512, 40516, 40520, 40524, 40528, 40532, 40536, 40540, 40544, 40548, 40552, 40556, 40560, 40564, 40568, 40572, 40576, 40580, 40584, 40588, 40592, 40596, 40600, 40604, 40608, 40612, 40616, 40620, 40624, 40628, 40632, 40636, 40640, 40644, 40648, 40652, 40656, 40660, 40664, 40668, 40672, 40676, 40680, 40684, 40688, 40692, 40696, 40700, 40704, 40708, 40712, 40716, 40720, 40724, 40728, 40732, 40736, 40740, 40744, 40748, 40752, 40756, 40760, 40764, 40768, 40772, 40776, 40780, 40784, 40788, 40792, 40796, 40800, 40804, 40808, 40812, 40816, 40820, 40824, 40828, 40832, 40836, 40840, 40844, 40848, 40852, 40856, 40860, 40864, 40868, 40872, 40876, 40880, 40884, 40888, 40892, 40896, 40900, 40904, 40908, 40912, 40916, 40920, 40924, 40928, 40932, 40936, 40940, 40944, 40948, 40952, 40956, 40960, 40964, 40968, 40972, 40976, 40980, 40984, 40988, 40992, 40996, 41e3, 41004, 41008, 41012, 41016, 41020, 41024, 41028, 41032, 41036, 41040, 41044, 41048, 41052, 41056, 41060, 41064, 41068, 41072, 41076, 41080, 41084, 41088, 41092, 41096, 41100, 41104, 41108, 41112, 41116, 41120, 41124, 41128, 41132, 41136, 41140, 41144, 41148, 41152, 41156, 41160, 41164, 41168, 41172, 41176, 41180, 41184, 41188, 41192, 41196, 41200, 41204, 41208, 41212, 41216, 41220, 41224, 41228, 41232, 41236, 41240, 41244, 41248, 41252, 41256, 41260, 41264, 41268, 41272, 41276, 41280, 41284, 41288, 41292, 41296, 41300, 41304, 41308, 41312, 41316, 41320, 41324, 41328, 41332, 41336, 41340, 41344, 41348, 41352, 41356, 41360, 41364, 41368, 41372, 41376, 41380, 41384, 41388, 41392, 41396, 41400, 41404, 41408, 41412, 41416, 41420, 41424, 41428, 41432, 41436, 41440, 41444, 41448, 41452, 41456, 41460, 41464, 41468, 41472, 41476, 41480, 41484, 41488, 41492, 41496, 41500, 41504, 41508, 41512, 41516, 41520, 41524, 41528, 41532, 41536, 41540, 41544, 41548, 41552, 41556, 41560, 41564, 41568, 41572, 41576, 41580, 41584, 41588, 41592, 41596, 41600, 41604, 41608, 41612, 41616, 41620, 41624, 41628, 41632, 41636, 41640, 41644, 41648, 41652, 41656, 41660, 41664, 41668, 41672, 41676, 41680, 41684, 41688, 41692, 41696, 41700, 41704, 41708, 41712, 41716, 41720, 41724, 41728, 41732, 41736, 41740, 41744, 41748, 41752, 41756, 41760, 41764, 41768, 41772, 41776, 41780, 41784, 41788, 41792, 41796, 41800, 41804, 41808, 41812, 41816, 41820, 41824, 41828, 41832, 41836, 41840, 41844, 41848, 41852, 41856, 41860, 41864, 41868, 41872, 41876, 41880, 41884, 41888, 41892, 41896, 41900, 41904, 41908, 41912, 41916, 41920, 41924, 41928, 41932, 41936, 41940, 41944, 41948, 41952, 41956, 41960, 41964, 41968, 41972, 41976, 41980, 41984, 41988, 41992, 41996, 42e3, 42004, 42008, 42012, 42016, 42020, 42024, 42028, 42032, 42036, 42040, 42044, 42048, 42052, 42056, 42060, 42064, 42068, 42072, 42076, 42080, 42084, 42088, 42092, 42096, 42100, 42104, 42108, 42112, 42116, 42120, 42124, 42128, 42132, 42136, 42140, 42144, 42148, 42152, 42156, 42160, 42164, 42168, 42172, 42176, 42180, 42184, 42188, 42192, 42196, 42200, 42204, 42208, 42212, 42216, 42220, 42224, 42228, 42232, 42236, 42240, 42244, 42248, 42252, 42256, 42260, 42264, 42268, 42272, 42276, 42280, 42284, 42288, 42292, 42296, 42300, 42304, 42308, 42312, 42316, 42320, 42324, 42328, 42332, 42336, 42340, 42344, 42348, 42352, 42356, 42360, 42364, 42368, 42372, 42376, 42380, 42384, 42388, 42392, 42396, 42400, 42404, 42408, 42412, 42416, 42420, 42424, 42428, 42432, 42436, 42440, 42444, 42448, 42452, 42456, 42460, 42464, 42468, 42472, 42476, 42480, 42484, 42488, 42492, 42496, 42500, 42504, 42508, 42512, 42516, 42520, 42524, 42528, 42532, 42536, 42540, 42544, 42548, 42552, 42556, 42560, 42564, 42568, 42572, 42576, 42580, 42584, 42588, 42592, 42596, 42600, 42604, 42608, 42612, 42616, 42620, 42624, 42628, 42632, 42636, 42640, 42644, 42648, 42652, 42656, 42660, 42664, 42668, 42672, 42676, 42680, 42684, 42688, 42692, 42696, 42700, 42704, 42708, 42712, 42716, 42720, 42724, 42728, 42732, 42736, 42740, 42744, 42748, 42752, 42756, 42760, 42764, 42768, 42772, 42776, 42780, 42784, 42788, 42792, 42796, 42800, 42804, 42808, 42812, 42816, 42820, 42824, 42828, 42832, 42836, 42840, 42844, 42848, 42852, 42856, 42860, 42864, 42868, 42872, 42876, 42880, 42884, 42888, 42892, 42896, 42900, 42904, 42908, 42912, 42916, 42920, 42924, 42928, 42932, 42936, 42940, 42944, 42948, 42952, 42956, 42960, 42964, 42968, 42972, 42976, 42980, 42984, 42988, 42992, 42996, 43e3, 43004, 43008, 43012, 43016, 43020, 43024, 43028, 43032, 43036, 43040, 43044, 43048, 43052, 43056, 43060, 43064, 43068, 43072, 43076, 43080, 43084, 43088, 43092, 43096, 43100, 43104, 43108, 43112, 43116, 43120, 43124, 43128, 43132, 43136, 43140, 43144, 43148, 43152, 43156, 43160, 43164, 43168, 43172, 43176, 43180, 43184, 43188, 43192, 43196, 43200, 43204, 43208, 43212, 43216, 43220, 43224, 43228, 43232, 43236, 43240, 43244, 43248, 43252, 43256, 43260, 43264, 43268, 43272, 43276, 43280, 43284, 43288, 43292, 43296, 43300, 43304, 43308, 43312, 43316, 43320, 43324, 43328, 43332, 43336, 43340, 43344, 43348, 43352, 43356, 43360, 43364, 43368, 43372, 43376, 43380, 43384, 43388, 43392, 43396, 43400, 43404, 43408, 43412, 43416, 43420, 43424, 43428, 43432, 43436, 43440, 43444, 43448, 43452, 43456, 43460, 43464, 43468, 43472, 43476, 43480, 43484, 43488, 43492, 43496, 43500, 43504, 43508, 43512, 43516, 43520, 43524, 43528, 43532, 43536, 43540, 43544, 43548, 43552, 43556, 43560, 43564, 43568, 43572, 43576, 43580, 43584, 43588, 43592, 43596, 43600, 43604, 43608, 43612, 43616, 43620, 43624, 43628, 43632, 43636, 43640, 43644, 43648, 43652, 43656, 43660, 43664, 43668, 43672, 43676, 43680, 43684, 43688, 43692, 43696, 43700, 43704, 43708, 43712, 43716, 43720, 43724, 43728, 43732, 43736, 43740, 43744, 43748, 43752, 43756, 43760, 43764, 43768, 43772, 43776, 43780, 43784, 43788, 43792, 43796, 43800, 43804, 43808, 43812, 43816, 43820, 43824, 43828, 43832, 43836, 43840, 43844, 43848, 43852, 43856, 43860, 43864, 43868, 43872, 43876, 43880, 43884, 43888, 43892, 43896, 43900, 43904, 43908, 43912, 43916, 43920, 43924, 43928, 43932, 43936, 43940, 43944, 43948, 43952, 43956, 43960, 43964, 43968, 43972, 43976, 43980, 43984, 43988, 43992, 43996, 44e3, 44004, 44008, 44012, 44016, 44020, 44024, 44028, 44032, 44036, 44040, 44044, 44048, 44052, 44056, 44060, 44064, 44068, 44072, 44076, 44080, 44084, 44088, 44092, 44096, 44100, 44104, 44108, 44112, 44116, 44120, 44124, 44128, 44132, 44136, 44140, 44144, 44148, 44152, 44156, 44160, 44164, 44168, 44172, 44176, 44180, 44184, 44188, 44192, 44196, 44200, 44204, 44208, 44212, 44216, 44220, 44224, 44228, 44232, 44236, 44240, 44244, 44248, 44252, 44256, 44260, 44264, 44268, 44272, 44276, 44280, 44284, 44288, 44292, 44296, 44300, 44304, 44308, 44312, 44316, 44320, 44324, 44328, 44332, 44336, 44340, 44344, 44348, 44352, 44356, 44360, 44364, 44368, 44372, 44376, 44380, 44384, 44388, 44392, 44396, 44400, 44404, 44408, 44412, 44416, 44420, 44424, 44428, 44432, 44436, 44440, 44444, 44448, 44452, 44456, 44460, 44464, 44468, 44472, 44476, 44480, 44484, 44488, 44492, 44496, 44500, 44504, 44508, 44512, 44516, 44520, 44524, 44528, 44532, 44536, 44540, 44544, 44548, 44552, 44556, 44560, 44564, 44568, 44572, 44576, 44580, 44584, 44588, 44592, 44596, 44600, 44604, 44608, 44612, 44616, 44620, 44624, 44628, 44632, 44636, 44640, 44644, 44648, 44652, 44656, 44660, 44664, 44668, 44672, 44676, 44680, 44684, 44688, 44692, 44696, 44700, 44704, 44708, 44712, 44716, 44720, 44724, 44728, 44732, 44736, 44740, 44744, 44748, 44752, 44756, 44760, 44764, 44768, 44772, 44776, 44780, 44784, 44788, 44792, 44796, 44800, 44804, 44808, 44812, 44816, 44820, 44824, 44828, 44832, 44836, 44840, 44844, 44848, 44852, 44856, 44860, 44864, 44868, 44872, 44876, 44880, 44884, 44888, 44892, 44896, 44900, 44904, 44908, 44912, 44916, 44920, 44924, 44928, 44932, 44936, 44940, 44944, 44948, 44952, 44956, 44960, 44964, 44968, 44972, 44976, 44980, 44984, 44988, 44992, 44996, 45e3, 45004, 45008, 45012, 45016, 45020, 45024, 45028, 45032, 45036, 45040, 45044, 45048, 45052, 45056, 45060, 45064, 45068, 45072, 45076, 45080, 45084, 45088, 45092, 45096, 45100, 45104, 45108, 45112, 45116, 45120, 45124, 45128, 45132, 45136, 45140, 45144, 45148, 45152, 45156, 45160, 45164, 45168, 45172, 45176, 45180, 45184, 45188, 45192, 45196, 45200, 45204, 45208, 45212, 45216, 45220, 45224, 45228, 45232, 45236, 45240, 45244, 45248, 45252, 45256, 45260, 45264, 45268, 45272, 45276, 45280, 45284, 45288, 45292, 45296, 45300, 45304, 45308, 45312, 45316, 45320, 45324, 45328, 45332, 45336, 45340, 45344, 45348, 45352, 45356, 45360, 45364, 45368, 45372, 45376, 45380, 45384, 45388, 45392, 45396, 45400, 45404, 45408, 45412, 45416, 45420, 45424, 45428, 45432, 45436, 45440, 45444, 45448, 45452, 45456, 45460, 45464, 45468, 45472, 45476, 45480, 45484, 45488, 45492, 45496, 45500, 45504, 45508, 45512, 45516, 45520, 45524, 45528, 45532, 45536, 45540, 45544, 45548, 45552, 45556, 45560, 45564, 45568, 45572, 45576, 45580, 45584, 45588, 45592, 45596, 45600, 45604, 45684, 45736, 45788, 45840, 45892, 45944, 45996, 46124, 46144, 46176, 46228, 46232, 46236, 46240, 46244, 46248, 46252, 46256, 46260, 46264, 46268, 46272, 46276, 46280, 46284, 46288, 46292, 46296, 46300, 46304, 46308, 46312, 46316, 46320, 46324, 46328, 46332, 46336, 46340, 46344, 46348, 46352, 46356, 46360, 46364, 46368, 46372, 46376, 46380, 46384, 46388, 46392, 46396, 46400, 46404, 46408, 46412, 46416, 46420, 46424, 46428, 46432, 46436, 46440, 46444, 46448, 46452, 46456, 46460, 46464, 46468, 46472, 46476, 46480, 46484, 46488, 46492, 46496, 46500, 46504, 46508, 46512, 46516, 46520, 46524, 46528, 46532, 46536, 46540, 46544, 46548, 46552, 46556, 46560, 46564, 46568, 46572, 46576, 46580, 46584, 46588, 46592, 46596, 46600, 46604, 46608, 46612, 46616, 46620, 46624, 46628, 46632, 46636, 46640, 46644, 46648, 46652, 46656, 46660, 46664, 46668, 46672, 46676, 46680, 46684, 46688, 46692, 46696, 46700, 46704, 46708, 46712, 46716, 46720, 46724, 46728, 46732, 46736, 46740, 46744, 46748, 46752, 46756, 46760, 46764, 46768, 46772, 46776, 46780, 46784, 46788, 46792, 46796, 46800, 46804, 46808, 46812, 46816, 46820, 46824, 46828, 46832, 46836, 46840, 46844, 46848, 46852, 46856, 46860, 46864, 46868, 46872, 46876, 46880, 46884, 46888, 46892, 46896, 46900, 46904, 46908, 46912, 46916, 46920, 46924, 46928, 46932, 46936, 46940, 46944, 46948, 46952, 46956, 46960, 46964, 46968, 46972, 46976, 46980, 46984, 46988, 46992, 46996, 47e3, 47004, 47008, 47012, 47016, 47020, 47024, 47028, 47032, 47036, 47040, 47044, 47048, 47052, 47056, 47060, 47064, 47068, 47072, 47076, 47080, 47084, 47088, 47092, 47096, 47100, 47104, 47108, 47112, 47116, 47120, 47124, 47128, 47132, 47136, 47140, 47144, 47148, 47152, 47156, 47160, 47164, 47168, 47172, 47176, 47180, 47184, 47188, 47192, 47196, 47200, 47204, 47208, 47212, 47216, 47220, 47224, 47228, 47232, 47236, 47240, 47244, 47248, 47252, 47256, 47260, 47264, 47268, 47272, 47276, 47280, 47284, 47288, 47292, 47296, 47300, 47304, 47308, 47312, 47316, 47320, 47324, 47328, 47332, 47336, 47340, 47344, 47348, 47352, 47356, 47360, 47364, 47368, 47372, 47376, 47380, 47384, 47388, 47392, 47396, 47400, 47404, 47408, 47412, 47416, 47420, 47424, 47428, 47432, 47436, 47440, 47444, 47448, 47452, 47456, 47460, 47464, 47468, 47472, 47476, 47480, 47484, 47488, 47492, 47496, 47500, 47504, 47508, 47512, 47516, 47520, 47524, 47528, 47532, 47536, 47540, 47544, 47548, 47552, 47556, 47560, 47564, 47568, 47572, 47576, 47580, 47584, 47588, 47592, 47596, 47600, 47604, 47608, 47612, 47616, 47620, 47624, 47628, 47632, 47636, 47640, 47644, 47648, 47652, 47656, 47660, 47664, 47668, 47672, 47676, 47680, 47684, 47688, 47692, 47696, 47700, 47704, 47708, 47712, 47716, 47720, 47724, 47728, 47732, 47736, 47740, 47744, 47748, 47752, 47756, 47760, 47764, 47768, 47772, 47776, 47780, 47784, 47788, 47792, 47796, 47800, 47804, 47808, 47812, 47816, 47820, 47824, 47828, 47832, 47836, 47840, 47844, 47848, 47852, 47856, 47860, 47864, 47868, 47872, 47876, 47880, 47884, 47888, 47892, 47896, 47900, 47904, 47908, 47912, 47916, 47920, 47924, 47928, 47932, 47936, 47940, 47944, 47948, 47952, 47956, 47960, 47964, 47968, 47992, 48048, 48104, 48592, 48988, 49688, 50060, 50104, 50108, 50112, 50116, 50120, 50124, 50128, 50132, 50136, 50188, 50280, 50376, 50528, 51568, 52016, 52108, 52208, 52488, 52536, 52564, 53528, 55280, 55796, 55840, 56008, 57928, 57932, 57936, 57940, 57944, 57948, 57952, 57956, 57960, 57964, 57968, 57972, 57976, 57980, 57984, 57988, 57992, 57996, 58e3, 58004, 58008, 58012, 58016, 58020, 58024, 58028, 58032, 58036, 58040, 58044, 58048, 58052, 58056, 58060, 58064, 59036, 59660, 59664, 59668, 59672, 59676, 59680, 59684, 59688, 59692, 59696, 59700, 59704, 59708, 59712, 59716, 59720, 59724, 59728, 59732, 59736, 59740, 59744, 59748, 59752, 59756, 59760, 59764, 59768, 59772, 59776, 59780, 59784, 59788, 60128, 60904, 60924, 61060, 61064, 61068, 61072, 61076, 61080, 61084, 61088, 61092, 61096, 61100, 61104, 61108, 61112, 61116, 61120, 61124, 61128, 61132, 61136, 61140, 61144, 61148, 61152, 61156, 61160, 61164, 61168, 61172, 61176, 61180, 61184, 61188, 61192, 61196, 61200, 61204, 61208, 61212, 61216, 61220, 61224, 61228, 61232, 61236, 61240, 61244, 61248, 61252, 61256, 61260, 61264, 61268, 61272, 61276, 61280, 61284, 61288, 61292, 61296, 61300, 61304, 61372, 61464, 61556, 61696, 64960, 65e3, 67012, 67016, 67020, 67024, 67028, 68192, 68204, 68344, 69020, 69096, 69276, 69400, 69752, 69856, 70404, 70828, 70900, 70908, 70940, 71420, 72044, 72352, 74124, 74216, 74220, 74224, 74228, 74232, 74236, 74240, 74244, 74248, 74252, 74256, 74260, 74264, 74268, 74272, 74276, 74280, 74284, 74288, 74292, 74296, 74300, 74304, 74308, 74312, 74316, 74320, 74324, 74328, 74332, 74336, 74340, 74344, 74348, 74352, 74356, 74360, 74364, 74368, 74372, 74376, 74380, 74384, 74388, 74392, 74396, 74496, 74584, 74864, 75196, 75656, 76056, 76060, 76064, 76068, 76072, 76076, 76080, 76084, 76088, 76092, 76096, 76100, 76104, 76108, 76112, 76116, 76120, 76124, 76128, 76132, 76136, 76140, 76144, 76148, 76152, 76156, 76160, 76164, 76168, 76172, 76176, 76180, 76184, 76188, 76192, 76196, 76200, 76204, 76208, 76212, 76216, 76220, 76224, 76228, 76232, 76236, 76240, 76244, 76248, 76252, 76256, 76260, 76264, 76268, 76272, 76276, 76280, 76284, 76288, 76292, 76296, 76300, 76304, 76308, 76312, 76316, 76320, 76324, 76328, 76332, 76336, 76340, 76344, 76348, 76352, 76356, 76360, 76364, 76368, 76372, 76376, 76380, 76384, 76388, 76392, 76396, 76400, 76404, 76408, 76412, 76416, 76420, 76424, 79196, 79304, 80008, 80496, 80976, 80980, 80984, 80988, 80992, 80996, 81e3, 81004, 81008, 81012, 81016, 81020, 81024, 81028, 81032, 81036, 81040, 81044, 81048, 81052, 81056, 81060, 81064, 81068, 81072, 81076, 81080, 81084, 81088, 81092, 81096, 81100, 81104, 81108, 81112, 81116, 81120, 81124, 81128, 81132, 81136, 81140, 81144, 81148, 81152, 81156, 81160, 81164, 81168, 81172, 81176, 81180, 81184, 81188, 81192, 81196, 81200, 81204, 81208, 81212, 81216, 81220, 81224, 81228, 81232, 81236, 81240, 81244, 81248, 81252, 81256, 81260, 81264, 81268, 81272, 81276, 81280, 81284, 81288, 81292, 81296, 81300, 81304, 81308, 81312, 81316, 81320, 81324, 81328, 81332, 81336, 81340, 81344, 81348, 81352, 81356, 81360, 81364, 81368, 81372, 81376, 81380, 81384, 81388, 81392, 81396, 81400, 81404, 81408, 81412, 81416, 81420, 81424, 81428, 81432, 81436, 81440, 81444, 81448, 81452, 81456, 81460, 81464, 81468, 81472, 81476, 81480, 81484, 81488, 81492, 81496, 81500, 81504, 81508, 81512, 81516, 81520, 81524, 81528, 81532, 81536, 81540, 81544, 81548, 81552, 81556, 81560, 81564, 81568, 81572, 81576, 81580, 81584, 81588, 81592, 81596, 81600, 81604, 81608, 81612, 81616, 81620, 81624, 81628, 81632, 81636, 81640, 81644, 81648, 81652, 81656, 81660, 81664, 81668, 81672, 81676, 81680, 81684, 81688, 81692, 81696, 81700, 81704, 81708, 81712, 81716, 81720, 81724, 81728, 81732, 81736, 81740, 81744, 81748, 81752, 81756, 81760, 81764, 81768, 81772, 81776, 81780, 81784, 81788, 81792, 81796, 81800, 81804, 81808, 81812, 81816, 81820, 81824, 81828, 81832, 81836, 81840, 81844, 81848, 81852, 81856, 81860, 81864, 81868, 81872, 81876, 81880, 81884, 81888, 81892, 81896, 81900, 81904, 81908, 81912, 81916, 81920, 81924, 81928, 81932, 81936, 81940, 81944, 81948, 81952, 81956, 81960, 81964, 81968, 81972, 81976, 81980, 81984, 81988, 81992, 81996, 82e3, 82004, 82008, 82012, 82016, 82020, 82024, 82028, 82032, 82036, 82040, 82044, 82048, 82052, 82056, 82060, 82064, 82068, 82072, 82076, 82080, 82084, 82088, 82092, 82096, 82100, 82104, 82108, 82112, 82116, 82120, 82124, 82128, 82132, 82136, 82140, 82144, 82148, 82152, 82156, 82160, 82164, 82168, 82172, 82176, 82180, 82184, 82188, 82192, 82196, 82200, 82204, 82208, 82212, 82216, 82220, 82224, 82228, 82232, 82236, 82240, 82244, 82248, 82252, 82256, 82260, 82264, 82268, 82272, 82276, 82280, 82284, 82288, 82292, 82296, 82300, 82304, 82308, 82312, 82316, 82320, 82324, 82328, 82332, 82336, 82340, 82344, 82348, 82352, 82356, 82360, 82364, 82368, 82372, 82376, 82380, 82384, 82388, 82392, 82396, 82400, 82404, 82408, 82412, 82416, 82420, 82424, 82428, 82432, 82436, 82440, 82444, 82448, 82452, 82456, 82460, 82464, 82468, 82472, 82476, 82480, 82484, 82488, 82492, 82496, 82500, 82504, 82508, 82512, 82516, 82520, 82524, 82528, 82532, 82536, 82540, 82544, 82548, 82552, 82556, 82560, 82564, 82568, 82572, 82576, 82580, 82584, 82588, 82592, 82596, 82600, 82604, 82608, 82612, 82616, 82620, 82624, 82628, 82632, 82636, 82640, 82644, 82648, 82652, 82656, 82660, 82664, 82668, 82672, 82676, 82680, 82684, 82688, 82692, 82696, 82700, 82704, 82708, 82712, 82716, 82720, 82724, 82728, 82732, 82736, 82740, 82744, 82748, 82752, 82756, 82760, 82764, 82768, 82772, 82776, 82780, 82784, 82788, 82792, 82796, 82800, 82804, 82808, 82812, 82816, 82820, 82824, 82828, 82832, 82836, 82840, 82844, 82848, 82852, 82856, 82860, 82864, 82868, 82872, 82876, 82880, 82884, 82888, 82892, 82896, 82900, 82904, 82908, 82912, 82916, 82920, 82924, 82928, 82932, 82936, 82940, 82944, 82948, 82952, 82956, 82960, 82964, 82968, 82972, 82976, 82980, 82984, 82988, 82992, 82996, 83e3, 83004, 83008, 83012, 83016, 83020, 83024, 83028, 84068, 84444, 1392, 1912, 1988, 2028, 2260, 2804, 2920, 4928, 5420, 7940, 13836, 14296, 17688, 26036, 26276, 49324, 53496, 56392, 56680, 56700, 59152, 62096, 66952, 66992, 67868, 67988, 68060, 69480, 71840, 71892, 71944, 72108, 72836, 72892, 73112, 73420, 73676, 73764, 73800, 73916, 74184, 75400, 75860, 75888, 75924, 76716, 77132, 77652, 77896, 79244, 79408, 79472, 79556, 79740, 80344, 80372, 80832, 83392, 83844, 83964, 84356, 84460, 84556, 84616]);
  for (var i = 0; i < relocations.length; i++) {
    HEAPU32[eb + relocations[i] >> 2] = HEAPU32[eb + relocations[i] >> 2] + eb
  }
});

function _emscripten_set_main_loop_timing(mode, value) {
  Browser.mainLoop.timingMode = mode;
  Browser.mainLoop.timingValue = value;
  if (!Browser.mainLoop.func) {
    return 1
  }
  if (mode == 0) {
    Browser.mainLoop.scheduler = function Browser_mainLoop_scheduler_setTimeout() {
      var timeUntilNextTick = Math.max(0, Browser.mainLoop.tickStartTime + value - _emscripten_get_now()) | 0;
      setTimeout(Browser.mainLoop.runner, timeUntilNextTick)
    };
    Browser.mainLoop.method = "timeout"
  } else if (mode == 1) {
    Browser.mainLoop.scheduler = function Browser_mainLoop_scheduler_rAF() {
      Browser.requestAnimationFrame(Browser.mainLoop.runner)
    };
    Browser.mainLoop.method = "rAF"
  } else if (mode == 2) {
    if (typeof setImmediate === "undefined") {
      var setImmediates = [];
      var emscriptenMainLoopMessageId = "setimmediate";
      var Browser_setImmediate_messageHandler = function (event) {
        if (event.data === emscriptenMainLoopMessageId || event.data.target === emscriptenMainLoopMessageId) {
          event.stopPropagation();
          setImmediates.shift()()
        }
      };
      addEventListener("message", Browser_setImmediate_messageHandler, true);
      setImmediate = function Browser_emulated_setImmediate(func) {
        setImmediates.push(func);
        if (ENVIRONMENT_IS_WORKER) {
          if (Module["setImmediates"] === undefined) Module["setImmediates"] = [];
          Module["setImmediates"].push(func);
          postMessage({
            target: emscriptenMainLoopMessageId
          })
        } else postMessage(emscriptenMainLoopMessageId, "*")
      }
    }
    Browser.mainLoop.scheduler = function Browser_mainLoop_scheduler_setImmediate() {
      setImmediate(Browser.mainLoop.runner)
    };
    Browser.mainLoop.method = "immediate"
  }
  return 0
}

function _emscripten_get_now() {
  abort()
}

function _emscripten_set_main_loop(func, fps, simulateInfiniteLoop, arg, noSetTiming) {
  noExitRuntime = true;
  assert(!Browser.mainLoop.func, "emscripten_set_main_loop: there can only be one main loop function at once: call emscripten_cancel_main_loop to cancel the previous one before setting a new one with different parameters.");
  Browser.mainLoop.func = func;
  Browser.mainLoop.arg = arg;
  var browserIterationFunc;
  if (typeof arg !== "undefined") {
    browserIterationFunc = function () {
      Module["dynCall_vi"](func, arg)
    }
  } else {
    browserIterationFunc = function () {
      Module["dynCall_v"](func)
    }
  }
  var thisMainLoopId = Browser.mainLoop.currentlyRunningMainloop;
  Browser.mainLoop.runner = function Browser_mainLoop_runner() {
    if (ABORT) return;
    if (Browser.mainLoop.queue.length > 0) {
      var start = Date.now();
      var blocker = Browser.mainLoop.queue.shift();
      blocker.func(blocker.arg);
      if (Browser.mainLoop.remainingBlockers) {
        var remaining = Browser.mainLoop.remainingBlockers;
        var next = remaining % 1 == 0 ? remaining - 1 : Math.floor(remaining);
        if (blocker.counted) {
          Browser.mainLoop.remainingBlockers = next
        } else {
          next = next + .5;
          Browser.mainLoop.remainingBlockers = (8 * remaining + next) / 9
        }
      }
      console.log('main loop blocker "' + blocker.name + '" took ' + (Date.now() - start) + " ms");
      Browser.mainLoop.updateStatus();
      if (thisMainLoopId < Browser.mainLoop.currentlyRunningMainloop) return;
      setTimeout(Browser.mainLoop.runner, 0);
      return
    }
    if (thisMainLoopId < Browser.mainLoop.currentlyRunningMainloop) return;
    Browser.mainLoop.currentFrameNumber = Browser.mainLoop.currentFrameNumber + 1 | 0;
    if (Browser.mainLoop.timingMode == 1 && Browser.mainLoop.timingValue > 1 && Browser.mainLoop.currentFrameNumber % Browser.mainLoop.timingValue != 0) {
      Browser.mainLoop.scheduler();
      return
    } else if (Browser.mainLoop.timingMode == 0) {
      Browser.mainLoop.tickStartTime = _emscripten_get_now()
    }
    if (Browser.mainLoop.method === "timeout" && Module.ctx) {
      err("Looks like you are rendering without using requestAnimationFrame for the main loop. You should use 0 for the frame rate in emscripten_set_main_loop in order to use requestAnimationFrame, as that can greatly improve your frame rates!");
      Browser.mainLoop.method = ""
    }
    Browser.mainLoop.runIter(browserIterationFunc);
    if (thisMainLoopId < Browser.mainLoop.currentlyRunningMainloop) return;
    if (typeof SDL === "object" && SDL.audio && SDL.audio.queueNewAudioData) SDL.audio.queueNewAudioData();
    Browser.mainLoop.scheduler()
  };
  if (!noSetTiming) {
    if (fps && fps > 0) _emscripten_set_main_loop_timing(0, 1e3 / fps);
    else _emscripten_set_main_loop_timing(1, 1);
    Browser.mainLoop.scheduler()
  }
  if (simulateInfiniteLoop) {
    throw "SimulateInfiniteLoop"
  }
}
var Browser = {
  mainLoop: {
    scheduler: null,
    method: "",
    currentlyRunningMainloop: 0,
    func: null,
    arg: 0,
    timingMode: 0,
    timingValue: 0,
    currentFrameNumber: 0,
    queue: [],
    pause: function () {
      Browser.mainLoop.scheduler = null;
      Browser.mainLoop.currentlyRunningMainloop++
    },
    resume: function () {
      Browser.mainLoop.currentlyRunningMainloop++;
      var timingMode = Browser.mainLoop.timingMode;
      var timingValue = Browser.mainLoop.timingValue;
      var func = Browser.mainLoop.func;
      Browser.mainLoop.func = null;
      _emscripten_set_main_loop(func, 0, false, Browser.mainLoop.arg, true);
      _emscripten_set_main_loop_timing(timingMode, timingValue);
      Browser.mainLoop.scheduler()
    },
    updateStatus: function () {
      if (Module["setStatus"]) {
        var message = Module["statusMessage"] || "Please wait...";
        var remaining = Browser.mainLoop.remainingBlockers;
        var expected = Browser.mainLoop.expectedBlockers;
        if (remaining) {
          if (remaining < expected) {
            Module["setStatus"](message + " (" + (expected - remaining) + "/" + expected + ")")
          } else {
            Module["setStatus"](message)
          }
        } else {
          Module["setStatus"]("")
        }
      }
    },
    runIter: function (func) {
      if (ABORT) return;
      if (Module["preMainLoop"]) {
        var preRet = Module["preMainLoop"]();
        if (preRet === false) {
          return
        }
      }
      try {
        func()
      } catch (e) {
        if (e instanceof ExitStatus) {
          return
        } else {
          if (e && typeof e === "object" && e.stack) err("exception thrown: " + [e, e.stack]);
          throw e
        }
      }
      if (Module["postMainLoop"]) Module["postMainLoop"]()
    }
  },
  isFullscreen: false,
  pointerLock: false,
  moduleContextCreatedCallbacks: [],
  workers: [],
  init: function () {
    if (!Module["preloadPlugins"]) Module["preloadPlugins"] = [];
    if (Browser.initted) return;
    Browser.initted = true;
    try {
      new Blob;
      Browser.hasBlobConstructor = true
    } catch (e) {
      Browser.hasBlobConstructor = false;
      console.log("warning: no blob constructor, cannot create blobs with mimetypes")
    }
    Browser.BlobBuilder = typeof MozBlobBuilder != "undefined" ? MozBlobBuilder : typeof WebKitBlobBuilder != "undefined" ? WebKitBlobBuilder : !Browser.hasBlobConstructor ? console.log("warning: no BlobBuilder") : null;
    Browser.URLObject = typeof window != "undefined" ? window.URL ? window.URL : window.webkitURL : undefined;
    if (!Module.noImageDecoding && typeof Browser.URLObject === "undefined") {
      console.log("warning: Browser does not support creating object URLs. Built-in browser image decoding will not be available.");
      Module.noImageDecoding = true
    }
    var imagePlugin = {};
    imagePlugin["canHandle"] = function imagePlugin_canHandle(name) {
      return !Module.noImageDecoding && /\.(jpg|jpeg|png|bmp)$/i.test(name)
    };
    imagePlugin["handle"] = function imagePlugin_handle(byteArray, name, onload, onerror) {
      var b = null;
      if (Browser.hasBlobConstructor) {
        try {
          b = new Blob([byteArray], {
            type: Browser.getMimetype(name)
          });
          if (b.size !== byteArray.length) {
            b = new Blob([new Uint8Array(byteArray).buffer], {
              type: Browser.getMimetype(name)
            })
          }
        } catch (e) {
          warnOnce("Blob constructor present but fails: " + e + "; falling back to blob builder")
        }
      }
      if (!b) {
        var bb = new Browser.BlobBuilder;
        bb.append(new Uint8Array(byteArray).buffer);
        b = bb.getBlob()
      }
      var url = Browser.URLObject.createObjectURL(b);
      var img = new Image;
      img.onload = function img_onload() {
        assert(img.complete, "Image " + name + " could not be decoded");
        var canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        var ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0);
        Module["preloadedImages"][name] = canvas;
        Browser.URLObject.revokeObjectURL(url);
        if (onload) onload(byteArray)
      };
      img.onerror = function img_onerror(event) {
        console.log("Image " + url + " could not be decoded");
        if (onerror) onerror()
      };
      img.src = url
    };
    Module["preloadPlugins"].push(imagePlugin);
    var audioPlugin = {};
    audioPlugin["canHandle"] = function audioPlugin_canHandle(name) {
      return !Module.noAudioDecoding && name.substr(-4) in {
        ".ogg": 1,
        ".wav": 1,
        ".mp3": 1
      }
    };
    audioPlugin["handle"] = function audioPlugin_handle(byteArray, name, onload, onerror) {
      var done = false;

      function finish(audio) {
        if (done) return;
        done = true;
        Module["preloadedAudios"][name] = audio;
        if (onload) onload(byteArray)
      }

      function fail() {
        if (done) return;
        done = true;
        Module["preloadedAudios"][name] = new Audio;
        if (onerror) onerror()
      }
      if (Browser.hasBlobConstructor) {
        try {
          var b = new Blob([byteArray], {
            type: Browser.getMimetype(name)
          })
        } catch (e) {
          return fail()
        }
        var url = Browser.URLObject.createObjectURL(b);
        var audio = new Audio;
        audio.addEventListener("canplaythrough", function () {
          finish(audio)
        }, false);
        audio.onerror = function audio_onerror(event) {
          if (done) return;
          console.log("warning: browser could not fully decode audio " + name + ", trying slower base64 approach");

          function encode64(data) {
            var BASE = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
            var PAD = "=";
            var ret = "";
            var leftchar = 0;
            var leftbits = 0;
            for (var i = 0; i < data.length; i++) {
              leftchar = leftchar << 8 | data[i];
              leftbits += 8;
              while (leftbits >= 6) {
                var curr = leftchar >> leftbits - 6 & 63;
                leftbits -= 6;
                ret += BASE[curr]
              }
            }
            if (leftbits == 2) {
              ret += BASE[(leftchar & 3) << 4];
              ret += PAD + PAD
            } else if (leftbits == 4) {
              ret += BASE[(leftchar & 15) << 2];
              ret += PAD
            }
            return ret
          }
          audio.src = "data:audio/x-" + name.substr(-3) + ";base64," + encode64(byteArray);
          finish(audio)
        };
        audio.src = url;
        Browser.safeSetTimeout(function () {
          finish(audio)
        }, 1e4)
      } else {
        return fail()
      }
    };
    Module["preloadPlugins"].push(audioPlugin);

    function pointerLockChange() {
      Browser.pointerLock = document["pointerLockElement"] === Module["canvas"] || document["mozPointerLockElement"] === Module["canvas"] || document["webkitPointerLockElement"] === Module["canvas"] || document["msPointerLockElement"] === Module["canvas"]
    }
    var canvas = Module["canvas"];
    if (canvas) {
      canvas.requestPointerLock = canvas["requestPointerLock"] || canvas["mozRequestPointerLock"] || canvas["webkitRequestPointerLock"] || canvas["msRequestPointerLock"] || function () { };
      canvas.exitPointerLock = document["exitPointerLock"] || document["mozExitPointerLock"] || document["webkitExitPointerLock"] || document["msExitPointerLock"] || function () { };
      canvas.exitPointerLock = canvas.exitPointerLock.bind(document);
      document.addEventListener("pointerlockchange", pointerLockChange, false);
      document.addEventListener("mozpointerlockchange", pointerLockChange, false);
      document.addEventListener("webkitpointerlockchange", pointerLockChange, false);
      document.addEventListener("mspointerlockchange", pointerLockChange, false);
      if (Module["elementPointerLock"]) {
        canvas.addEventListener("click", function (ev) {
          if (!Browser.pointerLock && Module["canvas"].requestPointerLock) {
            Module["canvas"].requestPointerLock();
            ev.preventDefault()
          }
        }, false)
      }
    }
  },
  createContext: function (canvas, useWebGL, setInModule, webGLContextAttributes) {
    if (useWebGL && Module.ctx && canvas == Module.canvas) return Module.ctx;
    var ctx;
    var contextHandle;
    if (useWebGL) {
      var contextAttributes = {
        antialias: false,
        alpha: false,
        majorVersion: 1
      };
      if (webGLContextAttributes) {
        for (var attribute in webGLContextAttributes) {
          contextAttributes[attribute] = webGLContextAttributes[attribute]
        }
      }
      if (typeof GL !== "undefined") {
        contextHandle = GL.createContext(canvas, contextAttributes);
        if (contextHandle) {
          ctx = GL.getContext(contextHandle).GLctx
        }
      }
    } else {
      ctx = canvas.getContext("2d")
    }
    if (!ctx) return null;
    if (setInModule) {
      if (!useWebGL) assert(typeof GLctx === "undefined", "cannot set in module if GLctx is used, but we are a non-GL context that would replace it");
      Module.ctx = ctx;
      if (useWebGL) GL.makeContextCurrent(contextHandle);
      Module.useWebGL = useWebGL;
      Browser.moduleContextCreatedCallbacks.forEach(function (callback) {
        callback()
      });
      Browser.init()
    }
    return ctx
  },
  destroyContext: function (canvas, useWebGL, setInModule) { },
  fullscreenHandlersInstalled: false,
  lockPointer: undefined,
  resizeCanvas: undefined,
  requestFullscreen: function (lockPointer, resizeCanvas, vrDevice) {
    Browser.lockPointer = lockPointer;
    Browser.resizeCanvas = resizeCanvas;
    Browser.vrDevice = vrDevice;
    if (typeof Browser.lockPointer === "undefined") Browser.lockPointer = true;
    if (typeof Browser.resizeCanvas === "undefined") Browser.resizeCanvas = false;
    if (typeof Browser.vrDevice === "undefined") Browser.vrDevice = null;
    var canvas = Module["canvas"];

    function fullscreenChange() {
      Browser.isFullscreen = false;
      var canvasContainer = canvas.parentNode;
      if ((document["fullscreenElement"] || document["mozFullScreenElement"] || document["msFullscreenElement"] || document["webkitFullscreenElement"] || document["webkitCurrentFullScreenElement"]) === canvasContainer) {
        canvas.exitFullscreen = Browser.exitFullscreen;
        if (Browser.lockPointer) canvas.requestPointerLock();
        Browser.isFullscreen = true;
        if (Browser.resizeCanvas) {
          Browser.setFullscreenCanvasSize()
        } else {
          Browser.updateCanvasDimensions(canvas)
        }
      } else {
        canvasContainer.parentNode.insertBefore(canvas, canvasContainer);
        canvasContainer.parentNode.removeChild(canvasContainer);
        if (Browser.resizeCanvas) {
          Browser.setWindowedCanvasSize()
        } else {
          Browser.updateCanvasDimensions(canvas)
        }
      }
      if (Module["onFullScreen"]) Module["onFullScreen"](Browser.isFullscreen);
      if (Module["onFullscreen"]) Module["onFullscreen"](Browser.isFullscreen)
    }
    if (!Browser.fullscreenHandlersInstalled) {
      Browser.fullscreenHandlersInstalled = true;
      document.addEventListener("fullscreenchange", fullscreenChange, false);
      document.addEventListener("mozfullscreenchange", fullscreenChange, false);
      document.addEventListener("webkitfullscreenchange", fullscreenChange, false);
      document.addEventListener("MSFullscreenChange", fullscreenChange, false)
    }
    var canvasContainer = document.createElement("div");
    canvas.parentNode.insertBefore(canvasContainer, canvas);
    canvasContainer.appendChild(canvas);
    canvasContainer.requestFullscreen = canvasContainer["requestFullscreen"] || canvasContainer["mozRequestFullScreen"] || canvasContainer["msRequestFullscreen"] || (canvasContainer["webkitRequestFullscreen"] ? function () {
      canvasContainer["webkitRequestFullscreen"](Element["ALLOW_KEYBOARD_INPUT"])
    } : null) || (canvasContainer["webkitRequestFullScreen"] ? function () {
      canvasContainer["webkitRequestFullScreen"](Element["ALLOW_KEYBOARD_INPUT"])
    } : null);
    if (vrDevice) {
      canvasContainer.requestFullscreen({
        vrDisplay: vrDevice
      })
    } else {
      canvasContainer.requestFullscreen()
    }
  },
  requestFullScreen: function (lockPointer, resizeCanvas, vrDevice) {
    err("Browser.requestFullScreen() is deprecated. Please call Browser.requestFullscreen instead.");
    Browser.requestFullScreen = function (lockPointer, resizeCanvas, vrDevice) {
      return Browser.requestFullscreen(lockPointer, resizeCanvas, vrDevice)
    };
    return Browser.requestFullscreen(lockPointer, resizeCanvas, vrDevice)
  },
  exitFullscreen: function () {
    if (!Browser.isFullscreen) {
      return false
    }
    var CFS = document["exitFullscreen"] || document["cancelFullScreen"] || document["mozCancelFullScreen"] || document["msExitFullscreen"] || document["webkitCancelFullScreen"] || function () { };
    CFS.apply(document, []);
    return true
  },
  nextRAF: 0,
  fakeRequestAnimationFrame: function (func) {
    var now = Date.now();
    if (Browser.nextRAF === 0) {
      Browser.nextRAF = now + 1e3 / 60
    } else {
      while (now + 2 >= Browser.nextRAF) {
        Browser.nextRAF += 1e3 / 60
      }
    }
    var delay = Math.max(Browser.nextRAF - now, 0);
    setTimeout(func, delay)
  },
  requestAnimationFrame: function (func) {
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(func);
      return
    }
    var RAF = Browser.fakeRequestAnimationFrame;
    RAF(func)
  },
  safeCallback: function (func) {
    return function () {
      if (!ABORT) return func.apply(null, arguments)
    }
  },
  allowAsyncCallbacks: true,
  queuedAsyncCallbacks: [],
  pauseAsyncCallbacks: function () {
    Browser.allowAsyncCallbacks = false
  },
  resumeAsyncCallbacks: function () {
    Browser.allowAsyncCallbacks = true;
    if (Browser.queuedAsyncCallbacks.length > 0) {
      var callbacks = Browser.queuedAsyncCallbacks;
      Browser.queuedAsyncCallbacks = [];
      callbacks.forEach(function (func) {
        func()
      })
    }
  },
  safeRequestAnimationFrame: function (func) {
    return Browser.requestAnimationFrame(function () {
      if (ABORT) return;
      if (Browser.allowAsyncCallbacks) {
        func()
      } else {
        Browser.queuedAsyncCallbacks.push(func)
      }
    })
  },
  safeSetTimeout: function (func, timeout) {
    noExitRuntime = true;
    return setTimeout(function () {
      if (ABORT) return;
      if (Browser.allowAsyncCallbacks) {
        func()
      } else {
        Browser.queuedAsyncCallbacks.push(func)
      }
    }, timeout)
  },
  safeSetInterval: function (func, timeout) {
    noExitRuntime = true;
    return setInterval(function () {
      if (ABORT) return;
      if (Browser.allowAsyncCallbacks) {
        func()
      }
    }, timeout)
  },
  getMimetype: function (name) {
    return {
      "jpg": "image/jpeg",
      "jpeg": "image/jpeg",
      "png": "image/png",
      "bmp": "image/bmp",
      "ogg": "audio/ogg",
      "wav": "audio/wav",
      "mp3": "audio/mpeg"
    }[name.substr(name.lastIndexOf(".") + 1)]
  },
  getUserMedia: function (func) {
    if (!window.getUserMedia) {
      window.getUserMedia = navigator["getUserMedia"] || navigator["mozGetUserMedia"]
    }
    window.getUserMedia(func)
  },
  getMovementX: function (event) {
    return event["movementX"] || event["mozMovementX"] || event["webkitMovementX"] || 0
  },
  getMovementY: function (event) {
    return event["movementY"] || event["mozMovementY"] || event["webkitMovementY"] || 0
  },
  getMouseWheelDelta: function (event) {
    var delta = 0;
    switch (event.type) {
      case "DOMMouseScroll":
        delta = event.detail / 3;
        break;
      case "mousewheel":
        delta = event.wheelDelta / 120;
        break;
      case "wheel":
        delta = event.deltaY;
        switch (event.deltaMode) {
          case 0:
            delta /= 100;
            break;
          case 1:
            delta /= 3;
            break;
          case 2:
            delta *= 80;
            break;
          default:
            throw "unrecognized mouse wheel delta mode: " + event.deltaMode
        }
        break;
      default:
        throw "unrecognized mouse wheel event: " + event.type
    }
    return delta
  },
  mouseX: 0,
  mouseY: 0,
  mouseMovementX: 0,
  mouseMovementY: 0,
  touches: {},
  lastTouches: {},
  calculateMouseEvent: function (event) {
    if (Browser.pointerLock) {
      if (event.type != "mousemove" && "mozMovementX" in event) {
        Browser.mouseMovementX = Browser.mouseMovementY = 0
      } else {
        Browser.mouseMovementX = Browser.getMovementX(event);
        Browser.mouseMovementY = Browser.getMovementY(event)
      }
      if (typeof SDL != "undefined") {
        Browser.mouseX = SDL.mouseX + Browser.mouseMovementX;
        Browser.mouseY = SDL.mouseY + Browser.mouseMovementY
      } else {
        Browser.mouseX += Browser.mouseMovementX;
        Browser.mouseY += Browser.mouseMovementY
      }
    } else {
      var rect = Module["canvas"].getBoundingClientRect();
      var cw = Module["canvas"].width;
      var ch = Module["canvas"].height;
      var scrollX = typeof window.scrollX !== "undefined" ? window.scrollX : window.pageXOffset;
      var scrollY = typeof window.scrollY !== "undefined" ? window.scrollY : window.pageYOffset;
      if (event.type === "touchstart" || event.type === "touchend" || event.type === "touchmove") {
        var touch = event.touch;
        if (touch === undefined) {
          return
        }
        var adjustedX = touch.pageX - (scrollX + rect.left);
        var adjustedY = touch.pageY - (scrollY + rect.top);
        adjustedX = adjustedX * (cw / rect.width);
        adjustedY = adjustedY * (ch / rect.height);
        var coords = {
          x: adjustedX,
          y: adjustedY
        };
        if (event.type === "touchstart") {
          Browser.lastTouches[touch.identifier] = coords;
          Browser.touches[touch.identifier] = coords
        } else if (event.type === "touchend" || event.type === "touchmove") {
          var last = Browser.touches[touch.identifier];
          if (!last) last = coords;
          Browser.lastTouches[touch.identifier] = last;
          Browser.touches[touch.identifier] = coords
        }
        return
      }
      var x = event.pageX - (scrollX + rect.left);
      var y = event.pageY - (scrollY + rect.top);
      x = x * (cw / rect.width);
      y = y * (ch / rect.height);
      Browser.mouseMovementX = x - Browser.mouseX;
      Browser.mouseMovementY = y - Browser.mouseY;
      Browser.mouseX = x;
      Browser.mouseY = y
    }
  },
  asyncLoad: function (url, onload, onerror, noRunDep) {
    var dep = !noRunDep ? getUniqueRunDependency("al " + url) : "";
    readAsync(url, function (arrayBuffer) {
      assert(arrayBuffer, 'Loading data file "' + url + '" failed (no arrayBuffer).');
      onload(new Uint8Array(arrayBuffer));
      if (dep) removeRunDependency(dep)
    }, function (event) {
      if (onerror) {
        onerror()
      } else {
        throw 'Loading data file "' + url + '" failed.'
      }
    });
    if (dep) addRunDependency(dep)
  },
  resizeListeners: [],
  updateResizeListeners: function () {
    var canvas = Module["canvas"];
    Browser.resizeListeners.forEach(function (listener) {
      listener(canvas.width, canvas.height)
    })
  },
  setCanvasSize: function (width, height, noUpdates) {
    var canvas = Module["canvas"];
    Browser.updateCanvasDimensions(canvas, width, height);
    if (!noUpdates) Browser.updateResizeListeners()
  },
  windowedWidth: 0,
  windowedHeight: 0,
  setFullscreenCanvasSize: function () {
    if (typeof SDL != "undefined") {
      var flags = HEAPU32[SDL.screen >> 2];
      flags = flags | 8388608;
      HEAP32[SDL.screen >> 2] = flags
    }
    Browser.updateCanvasDimensions(Module["canvas"]);
    Browser.updateResizeListeners()
  },
  setWindowedCanvasSize: function () {
    if (typeof SDL != "undefined") {
      var flags = HEAPU32[SDL.screen >> 2];
      flags = flags & ~8388608;
      HEAP32[SDL.screen >> 2] = flags
    }
    Browser.updateCanvasDimensions(Module["canvas"]);
    Browser.updateResizeListeners()
  },
  updateCanvasDimensions: function (canvas, wNative, hNative) {
    if (wNative && hNative) {
      canvas.widthNative = wNative;
      canvas.heightNative = hNative
    } else {
      wNative = canvas.widthNative;
      hNative = canvas.heightNative
    }
    var w = wNative;
    var h = hNative;
    if (Module["forcedAspectRatio"] && Module["forcedAspectRatio"] > 0) {
      if (w / h < Module["forcedAspectRatio"]) {
        w = Math.round(h * Module["forcedAspectRatio"])
      } else {
        h = Math.round(w / Module["forcedAspectRatio"])
      }
    }
    if ((document["fullscreenElement"] || document["mozFullScreenElement"] || document["msFullscreenElement"] || document["webkitFullscreenElement"] || document["webkitCurrentFullScreenElement"]) === canvas.parentNode && typeof screen != "undefined") {
      var factor = Math.min(screen.width / w, screen.height / h);
      w = Math.round(w * factor);
      h = Math.round(h * factor)
    }
    if (Browser.resizeCanvas) {
      if (canvas.width != w) canvas.width = w;
      if (canvas.height != h) canvas.height = h;
      if (typeof canvas.style != "undefined") {
        canvas.style.removeProperty("width");
        canvas.style.removeProperty("height")
      }
    } else {
      if (canvas.width != wNative) canvas.width = wNative;
      if (canvas.height != hNative) canvas.height = hNative;
      if (typeof canvas.style != "undefined") {
        if (w != wNative || h != hNative) {
          canvas.style.setProperty("width", w + "px", "important");
          canvas.style.setProperty("height", h + "px", "important")
        } else {
          canvas.style.removeProperty("width");
          canvas.style.removeProperty("height")
        }
      }
    }
  },
  wgetRequests: {},
  nextWgetRequestHandle: 0,
  getNextWgetRequestHandle: function () {
    var handle = Browser.nextWgetRequestHandle;
    Browser.nextWgetRequestHandle++;
    return handle
  }
};

function demangle(func) {
  return func
}

function demangleAll(text) {
  var regex = /\b__Z[\w\d_]+/g;
  return text.replace(regex, function (x) {
    var y = demangle(x);
    return x === y ? x : y + " [" + x + "]"
  })
}

function jsStackTrace() {
  var err = new Error;
  if (!err.stack) {
    try {
      throw new Error(0)
    } catch (e) {
      err = e
    }
    if (!err.stack) {
      return "(no stack trace available)"
    }
  }
  return err.stack.toString()
}

function stackTrace() {
  var js = jsStackTrace();
  if (Module["extraStackTrace"]) js += "\n" + Module["extraStackTrace"]();
  return demangleAll(js)
}

function ___setErrNo(value) {
  if (Module["___errno_location"]) HEAP32[Module["___errno_location"]() >> 2] = value;
  return value
}
var PATH = {
  splitPath: function (filename) {
    var splitPathRe = /^(\/?|)([\s\S]*?)((?:\.{1,2}|[^\/]+?|)(\.[^.\/]*|))(?:[\/]*)$/;
    return splitPathRe.exec(filename).slice(1)
  },
  normalizeArray: function (parts, allowAboveRoot) {
    var up = 0;
    for (var i = parts.length - 1; i >= 0; i--) {
      var last = parts[i];
      if (last === ".") {
        parts.splice(i, 1)
      } else if (last === "..") {
        parts.splice(i, 1);
        up++
      } else if (up) {
        parts.splice(i, 1);
        up--
      }
    }
    if (allowAboveRoot) {
      for (; up; up--) {
        parts.unshift("..")
      }
    }
    return parts
  },
  normalize: function (path) {
    var isAbsolute = path.charAt(0) === "/",
      trailingSlash = path.substr(-1) === "/";
    path = PATH.normalizeArray(path.split("/").filter(function (p) {
      return !!p
    }), !isAbsolute).join("/");
    if (!path && !isAbsolute) {
      path = "."
    }
    if (path && trailingSlash) {
      path += "/"
    }
    return (isAbsolute ? "/" : "") + path
  },
  dirname: function (path) {
    var result = PATH.splitPath(path),
      root = result[0],
      dir = result[1];
    if (!root && !dir) {
      return "."
    }
    if (dir) {
      dir = dir.substr(0, dir.length - 1)
    }
    return root + dir
  },
  basename: function (path) {
    if (path === "/") return "/";
    var lastSlash = path.lastIndexOf("/");
    if (lastSlash === -1) return path;
    return path.substr(lastSlash + 1)
  },
  extname: function (path) {
    return PATH.splitPath(path)[3]
  },
  join: function () {
    var paths = Array.prototype.slice.call(arguments, 0);
    return PATH.normalize(paths.join("/"))
  },
  join2: function (l, r) {
    return PATH.normalize(l + "/" + r)
  }
};
var PATH_FS = {
  resolve: function () {
    var resolvedPath = "",
      resolvedAbsolute = false;
    for (var i = arguments.length - 1; i >= -1 && !resolvedAbsolute; i--) {
      var path = i >= 0 ? arguments[i] : FS.cwd();
      if (typeof path !== "string") {
        throw new TypeError("Arguments to path.resolve must be strings")
      } else if (!path) {
        return ""
      }
      resolvedPath = path + "/" + resolvedPath;
      resolvedAbsolute = path.charAt(0) === "/"
    }
    resolvedPath = PATH.normalizeArray(resolvedPath.split("/").filter(function (p) {
      return !!p
    }), !resolvedAbsolute).join("/");
    return (resolvedAbsolute ? "/" : "") + resolvedPath || "."
  },
  relative: function (from, to) {
    from = PATH_FS.resolve(from).substr(1);
    to = PATH_FS.resolve(to).substr(1);

    function trim(arr) {
      var start = 0;
      for (; start < arr.length; start++) {
        if (arr[start] !== "") break
      }
      var end = arr.length - 1;
      for (; end >= 0; end--) {
        if (arr[end] !== "") break
      }
      if (start > end) return [];
      return arr.slice(start, end - start + 1)
    }
    var fromParts = trim(from.split("/"));
    var toParts = trim(to.split("/"));
    var length = Math.min(fromParts.length, toParts.length);
    var samePartsLength = length;
    for (var i = 0; i < length; i++) {
      if (fromParts[i] !== toParts[i]) {
        samePartsLength = i;
        break
      }
    }
    var outputParts = [];
    for (var i = samePartsLength; i < fromParts.length; i++) {
      outputParts.push("..")
    }
    outputParts = outputParts.concat(toParts.slice(samePartsLength));
    return outputParts.join("/")
  }
};
var TTY = {
  ttys: [],
  init: function () { },
  shutdown: function () { },
  register: function (dev, ops) {
    TTY.ttys[dev] = {
      input: [],
      output: [],
      ops: ops
    };
    FS.registerDevice(dev, TTY.stream_ops)
  },
  stream_ops: {
    open: function (stream) {
      var tty = TTY.ttys[stream.node.rdev];
      if (!tty) {
        throw new FS.ErrnoError(43)
      }
      stream.tty = tty;
      stream.seekable = false
    },
    close: function (stream) {
      stream.tty.ops.flush(stream.tty)
    },
    flush: function (stream) {
      stream.tty.ops.flush(stream.tty)
    },
    read: function (stream, buffer, offset, length, pos) {
      if (!stream.tty || !stream.tty.ops.get_char) {
        throw new FS.ErrnoError(60)
      }
      var bytesRead = 0;
      for (var i = 0; i < length; i++) {
        var result;
        try {
          result = stream.tty.ops.get_char(stream.tty)
        } catch (e) {
          throw new FS.ErrnoError(29)
        }
        if (result === undefined && bytesRead === 0) {
          throw new FS.ErrnoError(6)
        }
        if (result === null || result === undefined) break;
        bytesRead++;
        buffer[offset + i] = result
      }
      if (bytesRead) {
        stream.node.timestamp = Date.now()
      }
      return bytesRead
    },
    write: function (stream, buffer, offset, length, pos) {
      if (!stream.tty || !stream.tty.ops.put_char) {
        throw new FS.ErrnoError(60)
      }
      try {
        for (var i = 0; i < length; i++) {
          stream.tty.ops.put_char(stream.tty, buffer[offset + i])
        }
      } catch (e) {
        throw new FS.ErrnoError(29)
      }
      if (length) {
        stream.node.timestamp = Date.now()
      }
      return i
    }
  },
  default_tty_ops: {
    get_char: function (tty) {
      if (!tty.input.length) {
        var result = null;
        if (ENVIRONMENT_IS_NODE) {
          var BUFSIZE = 256;
          var buf = Buffer.alloc ? Buffer.alloc(BUFSIZE) : new Buffer(BUFSIZE);
          var bytesRead = 0;
          try {
            bytesRead = fs.readSync(process.stdin.fd, buf, 0, BUFSIZE, null)
          } catch (e) {
            if (e.toString().indexOf("EOF") != -1) bytesRead = 0;
            else throw e
          }
          if (bytesRead > 0) {
            result = buf.slice(0, bytesRead).toString("utf-8")
          } else {
            result = null
          }
        } else if (typeof window != "undefined" && typeof window.prompt == "function") {
          result = window.prompt("Input: ");
          if (result !== null) {
            result += "\n"
          }
        } else if (typeof readline == "function") {
          result = readline();
          if (result !== null) {
            result += "\n"
          }
        }
        if (!result) {
          return null
        }
        tty.input = intArrayFromString(result, true)
      }
      return tty.input.shift()
    },
    put_char: function (tty, val) {
      if (val === null || val === 10) {
        out(UTF8ArrayToString(tty.output, 0));
        tty.output = []
      } else {
        if (val != 0) tty.output.push(val)
      }
    },
    flush: function (tty) {
      if (tty.output && tty.output.length > 0) {
        out(UTF8ArrayToString(tty.output, 0));
        tty.output = []
      }
    }
  },
  default_tty1_ops: {
    put_char: function (tty, val) {
      if (val === null || val === 10) {
        err(UTF8ArrayToString(tty.output, 0));
        tty.output = []
      } else {
        if (val != 0) tty.output.push(val)
      }
    },
    flush: function (tty) {
      if (tty.output && tty.output.length > 0) {
        err(UTF8ArrayToString(tty.output, 0));
        tty.output = []
      }
    }
  }
};
var MEMFS = {
  ops_table: null,
  mount: function (mount) {
    return MEMFS.createNode(null, "/", 16384 | 511, 0)
  },
  createNode: function (parent, name, mode, dev) {
    if (FS.isBlkdev(mode) || FS.isFIFO(mode)) {
      throw new FS.ErrnoError(63)
    }
    if (!MEMFS.ops_table) {
      MEMFS.ops_table = {
        dir: {
          node: {
            getattr: MEMFS.node_ops.getattr,
            setattr: MEMFS.node_ops.setattr,
            lookup: MEMFS.node_ops.lookup,
            mknod: MEMFS.node_ops.mknod,
            rename: MEMFS.node_ops.rename,
            unlink: MEMFS.node_ops.unlink,
            rmdir: MEMFS.node_ops.rmdir,
            readdir: MEMFS.node_ops.readdir,
            symlink: MEMFS.node_ops.symlink
          },
          stream: {
            llseek: MEMFS.stream_ops.llseek
          }
        },
        file: {
          node: {
            getattr: MEMFS.node_ops.getattr,
            setattr: MEMFS.node_ops.setattr
          },
          stream: {
            llseek: MEMFS.stream_ops.llseek,
            read: MEMFS.stream_ops.read,
            write: MEMFS.stream_ops.write,
            allocate: MEMFS.stream_ops.allocate,
            mmap: MEMFS.stream_ops.mmap,
            msync: MEMFS.stream_ops.msync
          }
        },
        link: {
          node: {
            getattr: MEMFS.node_ops.getattr,
            setattr: MEMFS.node_ops.setattr,
            readlink: MEMFS.node_ops.readlink
          },
          stream: {}
        },
        chrdev: {
          node: {
            getattr: MEMFS.node_ops.getattr,
            setattr: MEMFS.node_ops.setattr
          },
          stream: FS.chrdev_stream_ops
        }
      }
    }
    var node = FS.createNode(parent, name, mode, dev);
    if (FS.isDir(node.mode)) {
      node.node_ops = MEMFS.ops_table.dir.node;
      node.stream_ops = MEMFS.ops_table.dir.stream;
      node.contents = {}
    } else if (FS.isFile(node.mode)) {
      node.node_ops = MEMFS.ops_table.file.node;
      node.stream_ops = MEMFS.ops_table.file.stream;
      node.usedBytes = 0;
      node.contents = null
    } else if (FS.isLink(node.mode)) {
      node.node_ops = MEMFS.ops_table.link.node;
      node.stream_ops = MEMFS.ops_table.link.stream
    } else if (FS.isChrdev(node.mode)) {
      node.node_ops = MEMFS.ops_table.chrdev.node;
      node.stream_ops = MEMFS.ops_table.chrdev.stream
    }
    node.timestamp = Date.now();
    if (parent) {
      parent.contents[name] = node
    }
    return node
  },
  getFileDataAsRegularArray: function (node) {
    if (node.contents && node.contents.subarray) {
      var arr = [];
      for (var i = 0; i < node.usedBytes; ++i) arr.push(node.contents[i]);
      return arr
    }
    return node.contents
  },
  getFileDataAsTypedArray: function (node) {
    if (!node.contents) return new Uint8Array;
    if (node.contents.subarray) return node.contents.subarray(0, node.usedBytes);
    return new Uint8Array(node.contents)
  },
  expandFileStorage: function (node, newCapacity) {
    var prevCapacity = node.contents ? node.contents.length : 0;
    if (prevCapacity >= newCapacity) return;
    var CAPACITY_DOUBLING_MAX = 1024 * 1024;
    newCapacity = Math.max(newCapacity, prevCapacity * (prevCapacity < CAPACITY_DOUBLING_MAX ? 2 : 1.125) | 0);
    if (prevCapacity != 0) newCapacity = Math.max(newCapacity, 256);
    var oldContents = node.contents;
    node.contents = new Uint8Array(newCapacity);
    if (node.usedBytes > 0) node.contents.set(oldContents.subarray(0, node.usedBytes), 0);
    return
  },
  resizeFileStorage: function (node, newSize) {
    if (node.usedBytes == newSize) return;
    if (newSize == 0) {
      node.contents = null;
      node.usedBytes = 0;
      return
    }
    if (!node.contents || node.contents.subarray) {
      var oldContents = node.contents;
      node.contents = new Uint8Array(new ArrayBuffer(newSize));
      if (oldContents) {
        node.contents.set(oldContents.subarray(0, Math.min(newSize, node.usedBytes)))
      }
      node.usedBytes = newSize;
      return
    }
    if (!node.contents) node.contents = [];
    if (node.contents.length > newSize) node.contents.length = newSize;
    else
      while (node.contents.length < newSize) node.contents.push(0);
    node.usedBytes = newSize
  },
  node_ops: {
    getattr: function (node) {
      var attr = {};
      attr.dev = FS.isChrdev(node.mode) ? node.id : 1;
      attr.ino = node.id;
      attr.mode = node.mode;
      attr.nlink = 1;
      attr.uid = 0;
      attr.gid = 0;
      attr.rdev = node.rdev;
      if (FS.isDir(node.mode)) {
        attr.size = 4096
      } else if (FS.isFile(node.mode)) {
        attr.size = node.usedBytes
      } else if (FS.isLink(node.mode)) {
        attr.size = node.link.length
      } else {
        attr.size = 0
      }
      attr.atime = new Date(node.timestamp);
      attr.mtime = new Date(node.timestamp);
      attr.ctime = new Date(node.timestamp);
      attr.blksize = 4096;
      attr.blocks = Math.ceil(attr.size / attr.blksize);
      return attr
    },
    setattr: function (node, attr) {
      if (attr.mode !== undefined) {
        node.mode = attr.mode
      }
      if (attr.timestamp !== undefined) {
        node.timestamp = attr.timestamp
      }
      if (attr.size !== undefined) {
        MEMFS.resizeFileStorage(node, attr.size)
      }
    },
    lookup: function (parent, name) {
      throw FS.genericErrors[44]
    },
    mknod: function (parent, name, mode, dev) {
      return MEMFS.createNode(parent, name, mode, dev)
    },
    rename: function (old_node, new_dir, new_name) {
      if (FS.isDir(old_node.mode)) {
        var new_node;
        try {
          new_node = FS.lookupNode(new_dir, new_name)
        } catch (e) { }
        if (new_node) {
          for (var i in new_node.contents) {
            throw new FS.ErrnoError(55)
          }
        }
      }
      delete old_node.parent.contents[old_node.name];
      old_node.name = new_name;
      new_dir.contents[new_name] = old_node;
      old_node.parent = new_dir
    },
    unlink: function (parent, name) {
      delete parent.contents[name]
    },
    rmdir: function (parent, name) {
      var node = FS.lookupNode(parent, name);
      for (var i in node.contents) {
        throw new FS.ErrnoError(55)
      }
      delete parent.contents[name]
    },
    readdir: function (node) {
      var entries = [".", ".."];
      for (var key in node.contents) {
        if (!node.contents.hasOwnProperty(key)) {
          continue
        }
        entries.push(key)
      }
      return entries
    },
    symlink: function (parent, newname, oldpath) {
      var node = MEMFS.createNode(parent, newname, 511 | 40960, 0);
      node.link = oldpath;
      return node
    },
    readlink: function (node) {
      if (!FS.isLink(node.mode)) {
        throw new FS.ErrnoError(28)
      }
      return node.link
    }
  },
  stream_ops: {
    read: function (stream, buffer, offset, length, position) {
      var contents = stream.node.contents;
      if (position >= stream.node.usedBytes) return 0;
      var size = Math.min(stream.node.usedBytes - position, length);
      if (size > 8 && contents.subarray) {
        buffer.set(contents.subarray(position, position + size), offset)
      } else {
        for (var i = 0; i < size; i++) buffer[offset + i] = contents[position + i]
      }
      return size
    },
    write: function (stream, buffer, offset, length, position, canOwn) {
      canOwn = false;
      if (!length) return 0;
      var node = stream.node;
      node.timestamp = Date.now();
      if (buffer.subarray && (!node.contents || node.contents.subarray)) {
        if (canOwn) {
          node.contents = buffer.subarray(offset, offset + length);
          node.usedBytes = length;
          return length
        } else if (node.usedBytes === 0 && position === 0) {
          node.contents = new Uint8Array(buffer.subarray(offset, offset + length));
          node.usedBytes = length;
          return length
        } else if (position + length <= node.usedBytes) {
          node.contents.set(buffer.subarray(offset, offset + length), position);
          return length
        }
      }
      MEMFS.expandFileStorage(node, position + length);
      if (node.contents.subarray && buffer.subarray) node.contents.set(buffer.subarray(offset, offset + length), position);
      else {
        for (var i = 0; i < length; i++) {
          node.contents[position + i] = buffer[offset + i]
        }
      }
      node.usedBytes = Math.max(node.usedBytes, position + length);
      return length
    },
    llseek: function (stream, offset, whence) {
      var position = offset;
      if (whence === 1) {
        position += stream.position
      } else if (whence === 2) {
        if (FS.isFile(stream.node.mode)) {
          position += stream.node.usedBytes
        }
      }
      if (position < 0) {
        throw new FS.ErrnoError(28)
      }
      return position
    },
    allocate: function (stream, offset, length) {
      MEMFS.expandFileStorage(stream.node, offset + length);
      stream.node.usedBytes = Math.max(stream.node.usedBytes, offset + length)
    },
    mmap: function (stream, buffer, offset, length, position, prot, flags) {
      if (!FS.isFile(stream.node.mode)) {
        throw new FS.ErrnoError(43)
      }
      var ptr;
      var allocated;
      var contents = stream.node.contents;
      if (!(flags & 2) && (contents.buffer === buffer || contents.buffer === buffer.buffer)) {
        allocated = false;
        ptr = contents.byteOffset
      } else {
        if (position > 0 || position + length < stream.node.usedBytes) {
          if (contents.subarray) {
            contents = contents.subarray(position, position + length)
          } else {
            contents = Array.prototype.slice.call(contents, position, position + length)
          }
        }
        allocated = true;
        var fromHeap = buffer.buffer == HEAP8.buffer;
        ptr = _malloc(length);
        if (!ptr) {
          throw new FS.ErrnoError(48)
        } (fromHeap ? HEAP8 : buffer).set(contents, ptr)
      }
      return {
        ptr: ptr,
        allocated: allocated
      }
    },
    msync: function (stream, buffer, offset, length, mmapFlags) {
      if (!FS.isFile(stream.node.mode)) {
        throw new FS.ErrnoError(43)
      }
      if (mmapFlags & 2) {
        return 0
      }
      var bytesWritten = MEMFS.stream_ops.write(stream, buffer, 0, length, offset, false);
      return 0
    }
  }
};
var IDBFS = {
  dbs: {},
  indexedDB: function () {
    if (typeof indexedDB !== "undefined") return indexedDB;
    var ret = null;
    if (typeof window === "object") ret = window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB;
    assert(ret, "IDBFS used, but indexedDB not supported");
    return ret
  },
  DB_VERSION: 21,
  DB_STORE_NAME: "FILE_DATA",
  mount: function (mount) {
    return MEMFS.mount.apply(null, arguments)
  },
  syncfs: function (mount, populate, callback) {
    IDBFS.getLocalSet(mount, function (err, local) {
      if (err) return callback(err);
      IDBFS.getRemoteSet(mount, function (err, remote) {
        if (err) return callback(err);
        var src = populate ? remote : local;
        var dst = populate ? local : remote;
        IDBFS.reconcile(src, dst, callback)
      })
    })
  },
  getDB: function (name, callback) {
    var db = IDBFS.dbs[name];
    if (db) {
      return callback(null, db)
    }
    var req;
    try {
      req = IDBFS.indexedDB().open(name, IDBFS.DB_VERSION)
    } catch (e) {
      return callback(e)
    }
    if (!req) {
      return callback("Unable to connect to IndexedDB")
    }
    req.onupgradeneeded = function (e) {
      var db = e.target.result;
      var transaction = e.target.transaction;
      var fileStore;
      if (db.objectStoreNames.contains(IDBFS.DB_STORE_NAME)) {
        fileStore = transaction.objectStore(IDBFS.DB_STORE_NAME)
      } else {
        fileStore = db.createObjectStore(IDBFS.DB_STORE_NAME)
      }
      if (!fileStore.indexNames.contains("timestamp")) {
        fileStore.createIndex("timestamp", "timestamp", {
          unique: false
        })
      }
    };
    req.onsuccess = function () {
      db = req.result;
      IDBFS.dbs[name] = db;
      callback(null, db)
    };
    req.onerror = function (e) {
      callback(this.error);
      e.preventDefault()
    }
  },
  getLocalSet: function (mount, callback) {
    var entries = {};

    function isRealDir(p) {
      return p !== "." && p !== ".."
    }

    function toAbsolute(root) {
      return function (p) {
        return PATH.join2(root, p)
      }
    }
    var check = FS.readdir(mount.mountpoint).filter(isRealDir).map(toAbsolute(mount.mountpoint));
    while (check.length) {
      var path = check.pop();
      var stat;
      try {
        stat = FS.stat(path)
      } catch (e) {
        return callback(e)
      }
      if (FS.isDir(stat.mode)) {
        check.push.apply(check, FS.readdir(path).filter(isRealDir).map(toAbsolute(path)))
      }
      entries[path] = {
        timestamp: stat.mtime
      }
    }
    return callback(null, {
      type: "local",
      entries: entries
    })
  },
  getRemoteSet: function (mount, callback) {
    var entries = {};
    IDBFS.getDB(mount.mountpoint, function (err, db) {
      if (err) return callback(err);
      try {
        var transaction = db.transaction([IDBFS.DB_STORE_NAME], "readonly");
        transaction.onerror = function (e) {
          callback(this.error);
          e.preventDefault()
        };
        var store = transaction.objectStore(IDBFS.DB_STORE_NAME);
        var index = store.index("timestamp");
        index.openKeyCursor().onsuccess = function (event) {
          var cursor = event.target.result;
          if (!cursor) {
            return callback(null, {
              type: "remote",
              db: db,
              entries: entries
            })
          }
          entries[cursor.primaryKey] = {
            timestamp: cursor.key
          };
          cursor.continue()
        }
      } catch (e) {
        return callback(e)
      }
    })
  },
  loadLocalEntry: function (path, callback) {
    var stat, node;
    try {
      var lookup = FS.lookupPath(path);
      node = lookup.node;
      stat = FS.stat(path)
    } catch (e) {
      return callback(e)
    }
    if (FS.isDir(stat.mode)) {
      return callback(null, {
        timestamp: stat.mtime,
        mode: stat.mode
      })
    } else if (FS.isFile(stat.mode)) {
      node.contents = MEMFS.getFileDataAsTypedArray(node);
      return callback(null, {
        timestamp: stat.mtime,
        mode: stat.mode,
        contents: node.contents
      })
    } else {
      return callback(new Error("node type not supported"))
    }
  },
  storeLocalEntry: function (path, entry, callback) {
    try {
      if (FS.isDir(entry.mode)) {
        FS.mkdir(path, entry.mode)
      } else if (FS.isFile(entry.mode)) {
        FS.writeFile(path, entry.contents, {
          canOwn: true
        })
      } else {
        return callback(new Error("node type not supported"))
      }
      FS.chmod(path, entry.mode);
      FS.utime(path, entry.timestamp, entry.timestamp)
    } catch (e) {
      return callback(e)
    }
    callback(null)
  },
  removeLocalEntry: function (path, callback) {
    try {
      var lookup = FS.lookupPath(path);
      var stat = FS.stat(path);
      if (FS.isDir(stat.mode)) {
        FS.rmdir(path)
      } else if (FS.isFile(stat.mode)) {
        FS.unlink(path)
      }
    } catch (e) {
      return callback(e)
    }
    callback(null)
  },
  loadRemoteEntry: function (store, path, callback) {
    var req = store.get(path);
    req.onsuccess = function (event) {
      callback(null, event.target.result)
    };
    req.onerror = function (e) {
      callback(this.error);
      e.preventDefault()
    }
  },
  storeRemoteEntry: function (store, path, entry, callback) {
    var req = store.put(entry, path);
    req.onsuccess = function () {
      callback(null)
    };
    req.onerror = function (e) {
      callback(this.error);
      e.preventDefault()
    }
  },
  removeRemoteEntry: function (store, path, callback) {
    var req = store.delete(path);
    req.onsuccess = function () {
      callback(null)
    };
    req.onerror = function (e) {
      callback(this.error);
      e.preventDefault()
    }
  },
  reconcile: function (src, dst, callback) {
    var total = 0;
    var create = [];
    Object.keys(src.entries).forEach(function (key) {
      var e = src.entries[key];
      var e2 = dst.entries[key];
      if (!e2 || e.timestamp > e2.timestamp) {
        create.push(key);
        total++
      }
    });
    var remove = [];
    Object.keys(dst.entries).forEach(function (key) {
      var e = dst.entries[key];
      var e2 = src.entries[key];
      if (!e2) {
        remove.push(key);
        total++
      }
    });
    if (!total) {
      return callback(null)
    }
    var errored = false;
    var db = src.type === "remote" ? src.db : dst.db;
    var transaction = db.transaction([IDBFS.DB_STORE_NAME], "readwrite");
    var store = transaction.objectStore(IDBFS.DB_STORE_NAME);

    function done(err) {
      if (err && !errored) {
        errored = true;
        return callback(err)
      }
    }
    transaction.onerror = function (e) {
      done(this.error);
      e.preventDefault()
    };
    transaction.oncomplete = function (e) {
      if (!errored) {
        callback(null)
      }
    };
    create.sort().forEach(function (path) {
      if (dst.type === "local") {
        IDBFS.loadRemoteEntry(store, path, function (err, entry) {
          if (err) return done(err);
          IDBFS.storeLocalEntry(path, entry, done)
        })
      } else {
        IDBFS.loadLocalEntry(path, function (err, entry) {
          if (err) return done(err);
          IDBFS.storeRemoteEntry(store, path, entry, done)
        })
      }
    });
    remove.sort().reverse().forEach(function (path) {
      if (dst.type === "local") {
        IDBFS.removeLocalEntry(path, done)
      } else {
        IDBFS.removeRemoteEntry(store, path, done)
      }
    })
  }
};
var ERRNO_CODES = {
  EPERM: 63,
  ENOENT: 44,
  ESRCH: 71,
  EINTR: 27,
  EIO: 29,
  ENXIO: 60,
  E2BIG: 1,
  ENOEXEC: 45,
  EBADF: 8,
  ECHILD: 12,
  EAGAIN: 6,
  EWOULDBLOCK: 6,
  ENOMEM: 48,
  EACCES: 2,
  EFAULT: 21,
  ENOTBLK: 105,
  EBUSY: 10,
  EEXIST: 20,
  EXDEV: 75,
  ENODEV: 43,
  ENOTDIR: 54,
  EISDIR: 31,
  EINVAL: 28,
  ENFILE: 41,
  EMFILE: 33,
  ENOTTY: 59,
  ETXTBSY: 74,
  EFBIG: 22,
  ENOSPC: 51,
  ESPIPE: 70,
  EROFS: 69,
  EMLINK: 34,
  EPIPE: 64,
  EDOM: 18,
  ERANGE: 68,
  ENOMSG: 49,
  EIDRM: 24,
  ECHRNG: 106,
  EL2NSYNC: 156,
  EL3HLT: 107,
  EL3RST: 108,
  ELNRNG: 109,
  EUNATCH: 110,
  ENOCSI: 111,
  EL2HLT: 112,
  EDEADLK: 16,
  ENOLCK: 46,
  EBADE: 113,
  EBADR: 114,
  EXFULL: 115,
  ENOANO: 104,
  EBADRQC: 103,
  EBADSLT: 102,
  EDEADLOCK: 16,
  EBFONT: 101,
  ENOSTR: 100,
  ENODATA: 116,
  ETIME: 117,
  ENOSR: 118,
  ENONET: 119,
  ENOPKG: 120,
  EREMOTE: 121,
  ENOLINK: 47,
  EADV: 122,
  ESRMNT: 123,
  ECOMM: 124,
  EPROTO: 65,
  EMULTIHOP: 36,
  EDOTDOT: 125,
  EBADMSG: 9,
  ENOTUNIQ: 126,
  EBADFD: 127,
  EREMCHG: 128,
  ELIBACC: 129,
  ELIBBAD: 130,
  ELIBSCN: 131,
  ELIBMAX: 132,
  ELIBEXEC: 133,
  ENOSYS: 52,
  ENOTEMPTY: 55,
  ENAMETOOLONG: 37,
  ELOOP: 32,
  EOPNOTSUPP: 138,
  EPFNOSUPPORT: 139,
  ECONNRESET: 15,
  ENOBUFS: 42,
  EAFNOSUPPORT: 5,
  EPROTOTYPE: 67,
  ENOTSOCK: 57,
  ENOPROTOOPT: 50,
  ESHUTDOWN: 140,
  ECONNREFUSED: 14,
  EADDRINUSE: 3,
  ECONNABORTED: 13,
  ENETUNREACH: 40,
  ENETDOWN: 38,
  ETIMEDOUT: 73,
  EHOSTDOWN: 142,
  EHOSTUNREACH: 23,
  EINPROGRESS: 26,
  EALREADY: 7,
  EDESTADDRREQ: 17,
  EMSGSIZE: 35,
  EPROTONOSUPPORT: 66,
  ESOCKTNOSUPPORT: 137,
  EADDRNOTAVAIL: 4,
  ENETRESET: 39,
  EISCONN: 30,
  ENOTCONN: 53,
  ETOOMANYREFS: 141,
  EUSERS: 136,
  EDQUOT: 19,
  ESTALE: 72,
  ENOTSUP: 138,
  ENOMEDIUM: 148,
  EILSEQ: 25,
  EOVERFLOW: 61,
  ECANCELED: 11,
  ENOTRECOVERABLE: 56,
  EOWNERDEAD: 62,
  ESTRPIPE: 135
};
var NODEFS = {
  isWindows: false,
  staticInit: function () {
    NODEFS.isWindows = !!process.platform.match(/^win/);
    var flags = process["binding"]("constants");
    if (flags["fs"]) {
      flags = flags["fs"]
    }
    NODEFS.flagsForNodeMap = {
      1024: flags["O_APPEND"],
      64: flags["O_CREAT"],
      128: flags["O_EXCL"],
      0: flags["O_RDONLY"],
      2: flags["O_RDWR"],
      4096: flags["O_SYNC"],
      512: flags["O_TRUNC"],
      1: flags["O_WRONLY"]
    }
  },
  bufferFrom: function (arrayBuffer) {
    return Buffer["alloc"] ? Buffer.from(arrayBuffer) : new Buffer(arrayBuffer)
  },
  convertNodeCode: function (e) {
    var code = e.code;
    assert(code in ERRNO_CODES);
    return ERRNO_CODES[code]
  },
  mount: function (mount) {
    assert(ENVIRONMENT_HAS_NODE);
    return NODEFS.createNode(null, "/", NODEFS.getMode(mount.opts.root), 0)
  },
  createNode: function (parent, name, mode, dev) {
    if (!FS.isDir(mode) && !FS.isFile(mode) && !FS.isLink(mode)) {
      throw new FS.ErrnoError(28)
    }
    var node = FS.createNode(parent, name, mode);
    node.node_ops = NODEFS.node_ops;
    node.stream_ops = NODEFS.stream_ops;
    return node
  },
  getMode: function (path) {
    var stat;
    try {
      stat = fs.lstatSync(path);
      if (NODEFS.isWindows) {
        stat.mode = stat.mode | (stat.mode & 292) >> 2
      }
    } catch (e) {
      if (!e.code) throw e;
      throw new FS.ErrnoError(NODEFS.convertNodeCode(e))
    }
    return stat.mode
  },
  realPath: function (node) {
    var parts = [];
    while (node.parent !== node) {
      parts.push(node.name);
      node = node.parent
    }
    parts.push(node.mount.opts.root);
    parts.reverse();
    return PATH.join.apply(null, parts)
  },
  flagsForNode: function (flags) {
    flags &= ~2097152;
    flags &= ~2048;
    flags &= ~32768;
    flags &= ~524288;
    var newFlags = 0;
    for (var k in NODEFS.flagsForNodeMap) {
      if (flags & k) {
        newFlags |= NODEFS.flagsForNodeMap[k];
        flags ^= k
      }
    }
    if (!flags) {
      return newFlags
    } else {
      throw new FS.ErrnoError(28)
    }
  },
  node_ops: {
    getattr: function (node) {
      var path = NODEFS.realPath(node);
      var stat;
      try {
        stat = fs.lstatSync(path)
      } catch (e) {
        if (!e.code) throw e;
        throw new FS.ErrnoError(NODEFS.convertNodeCode(e))
      }
      if (NODEFS.isWindows && !stat.blksize) {
        stat.blksize = 4096
      }
      if (NODEFS.isWindows && !stat.blocks) {
        stat.blocks = (stat.size + stat.blksize - 1) / stat.blksize | 0
      }
      return {
        dev: stat.dev,
        ino: stat.ino,
        mode: stat.mode,
        nlink: stat.nlink,
        uid: stat.uid,
        gid: stat.gid,
        rdev: stat.rdev,
        size: stat.size,
        atime: stat.atime,
        mtime: stat.mtime,
        ctime: stat.ctime,
        blksize: stat.blksize,
        blocks: stat.blocks
      }
    },
    setattr: function (node, attr) {
      var path = NODEFS.realPath(node);
      try {
        if (attr.mode !== undefined) {
          fs.chmodSync(path, attr.mode);
          node.mode = attr.mode
        }
        if (attr.timestamp !== undefined) {
          var date = new Date(attr.timestamp);
          fs.utimesSync(path, date, date)
        }
        if (attr.size !== undefined) {
          fs.truncateSync(path, attr.size)
        }
      } catch (e) {
        if (!e.code) throw e;
        throw new FS.ErrnoError(NODEFS.convertNodeCode(e))
      }
    },
    lookup: function (parent, name) {
      var path = PATH.join2(NODEFS.realPath(parent), name);
      var mode = NODEFS.getMode(path);
      return NODEFS.createNode(parent, name, mode)
    },
    mknod: function (parent, name, mode, dev) {
      var node = NODEFS.createNode(parent, name, mode, dev);
      var path = NODEFS.realPath(node);
      try {
        if (FS.isDir(node.mode)) {
          fs.mkdirSync(path, node.mode)
        } else {
          fs.writeFileSync(path, "", {
            mode: node.mode
          })
        }
      } catch (e) {
        if (!e.code) throw e;
        throw new FS.ErrnoError(NODEFS.convertNodeCode(e))
      }
      return node
    },
    rename: function (oldNode, newDir, newName) {
      var oldPath = NODEFS.realPath(oldNode);
      var newPath = PATH.join2(NODEFS.realPath(newDir), newName);
      try {
        fs.renameSync(oldPath, newPath)
      } catch (e) {
        if (!e.code) throw e;
        throw new FS.ErrnoError(NODEFS.convertNodeCode(e))
      }
    },
    unlink: function (parent, name) {
      var path = PATH.join2(NODEFS.realPath(parent), name);
      try {
        fs.unlinkSync(path)
      } catch (e) {
        if (!e.code) throw e;
        throw new FS.ErrnoError(NODEFS.convertNodeCode(e))
      }
    },
    rmdir: function (parent, name) {
      var path = PATH.join2(NODEFS.realPath(parent), name);
      try {
        fs.rmdirSync(path)
      } catch (e) {
        if (!e.code) throw e;
        throw new FS.ErrnoError(NODEFS.convertNodeCode(e))
      }
    },
    readdir: function (node) {
      var path = NODEFS.realPath(node);
      try {
        return fs.readdirSync(path)
      } catch (e) {
        if (!e.code) throw e;
        throw new FS.ErrnoError(NODEFS.convertNodeCode(e))
      }
    },
    symlink: function (parent, newName, oldPath) {
      var newPath = PATH.join2(NODEFS.realPath(parent), newName);
      try {
        fs.symlinkSync(oldPath, newPath)
      } catch (e) {
        if (!e.code) throw e;
        throw new FS.ErrnoError(NODEFS.convertNodeCode(e))
      }
    },
    readlink: function (node) {
      var path = NODEFS.realPath(node);
      try {
        path = fs.readlinkSync(path);
        path = NODEJS_PATH.relative(NODEJS_PATH.resolve(node.mount.opts.root), path);
        return path
      } catch (e) {
        if (!e.code) throw e;
        throw new FS.ErrnoError(NODEFS.convertNodeCode(e))
      }
    }
  },
  stream_ops: {
    open: function (stream) {
      var path = NODEFS.realPath(stream.node);
      try {
        if (FS.isFile(stream.node.mode)) {
          stream.nfd = fs.openSync(path, NODEFS.flagsForNode(stream.flags))
        }
      } catch (e) {
        if (!e.code) throw e;
        throw new FS.ErrnoError(NODEFS.convertNodeCode(e))
      }
    },
    close: function (stream) {
      try {
        if (FS.isFile(stream.node.mode) && stream.nfd) {
          fs.closeSync(stream.nfd)
        }
      } catch (e) {
        if (!e.code) throw e;
        throw new FS.ErrnoError(NODEFS.convertNodeCode(e))
      }
    },
    read: function (stream, buffer, offset, length, position) {
      if (length === 0) return 0;
      try {
        return fs.readSync(stream.nfd, NODEFS.bufferFrom(buffer.buffer), offset, length, position)
      } catch (e) {
        throw new FS.ErrnoError(NODEFS.convertNodeCode(e))
      }
    },
    write: function (stream, buffer, offset, length, position) {
      try {
        return fs.writeSync(stream.nfd, NODEFS.bufferFrom(buffer.buffer), offset, length, position)
      } catch (e) {
        throw new FS.ErrnoError(NODEFS.convertNodeCode(e))
      }
    },
    llseek: function (stream, offset, whence) {
      var position = offset;
      if (whence === 1) {
        position += stream.position
      } else if (whence === 2) {
        if (FS.isFile(stream.node.mode)) {
          try {
            var stat = fs.fstatSync(stream.nfd);
            position += stat.size
          } catch (e) {
            throw new FS.ErrnoError(NODEFS.convertNodeCode(e))
          }
        }
      }
      if (position < 0) {
        throw new FS.ErrnoError(28)
      }
      return position
    }
  }
};
var WORKERFS = {
  DIR_MODE: 16895,
  FILE_MODE: 33279,
  reader: null,
  mount: function (mount) {
    assert(ENVIRONMENT_IS_WORKER);
    if (!WORKERFS.reader) WORKERFS.reader = new FileReaderSync;
    var root = WORKERFS.createNode(null, "/", WORKERFS.DIR_MODE, 0);
    var createdParents = {};

    function ensureParent(path) {
      var parts = path.split("/");
      var parent = root;
      for (var i = 0; i < parts.length - 1; i++) {
        var curr = parts.slice(0, i + 1).join("/");
        if (!createdParents[curr]) {
          createdParents[curr] = WORKERFS.createNode(parent, parts[i], WORKERFS.DIR_MODE, 0)
        }
        parent = createdParents[curr]
      }
      return parent
    }

    function base(path) {
      var parts = path.split("/");
      return parts[parts.length - 1]
    }
    Array.prototype.forEach.call(mount.opts["files"] || [], function (file) {
      WORKERFS.createNode(ensureParent(file.name), base(file.name), WORKERFS.FILE_MODE, 0, file, file.lastModifiedDate)
    });
    (mount.opts["blobs"] || []).forEach(function (obj) {
      WORKERFS.createNode(ensureParent(obj["name"]), base(obj["name"]), WORKERFS.FILE_MODE, 0, obj["data"])
    });
    (mount.opts["packages"] || []).forEach(function (pack) {
      pack["metadata"].files.forEach(function (file) {
        var name = file.filename.substr(1);
        WORKERFS.createNode(ensureParent(name), base(name), WORKERFS.FILE_MODE, 0, pack["blob"].slice(file.start, file.end))
      })
    });
    return root
  },
  createNode: function (parent, name, mode, dev, contents, mtime) {
    var node = FS.createNode(parent, name, mode);
    node.mode = mode;
    node.node_ops = WORKERFS.node_ops;
    node.stream_ops = WORKERFS.stream_ops;
    node.timestamp = (mtime || new Date).getTime();
    assert(WORKERFS.FILE_MODE !== WORKERFS.DIR_MODE);
    if (mode === WORKERFS.FILE_MODE) {
      node.size = contents.size;
      node.contents = contents
    } else {
      node.size = 4096;
      node.contents = {}
    }
    if (parent) {
      parent.contents[name] = node
    }
    return node
  },
  node_ops: {
    getattr: function (node) {
      return {
        dev: 1,
        ino: undefined,
        mode: node.mode,
        nlink: 1,
        uid: 0,
        gid: 0,
        rdev: undefined,
        size: node.size,
        atime: new Date(node.timestamp),
        mtime: new Date(node.timestamp),
        ctime: new Date(node.timestamp),
        blksize: 4096,
        blocks: Math.ceil(node.size / 4096)
      }
    },
    setattr: function (node, attr) {
      if (attr.mode !== undefined) {
        node.mode = attr.mode
      }
      if (attr.timestamp !== undefined) {
        node.timestamp = attr.timestamp
      }
    },
    lookup: function (parent, name) {
      throw new FS.ErrnoError(44)
    },
    mknod: function (parent, name, mode, dev) {
      throw new FS.ErrnoError(63)
    },
    rename: function (oldNode, newDir, newName) {
      throw new FS.ErrnoError(63)
    },
    unlink: function (parent, name) {
      throw new FS.ErrnoError(63)
    },
    rmdir: function (parent, name) {
      throw new FS.ErrnoError(63)
    },
    readdir: function (node) {
      var entries = [".", ".."];
      for (var key in node.contents) {
        if (!node.contents.hasOwnProperty(key)) {
          continue
        }
        entries.push(key)
      }
      return entries
    },
    symlink: function (parent, newName, oldPath) {
      throw new FS.ErrnoError(63)
    },
    readlink: function (node) {
      throw new FS.ErrnoError(63)
    }
  },
  stream_ops: {
    read: function (stream, buffer, offset, length, position) {
      if (position >= stream.node.size) return 0;
      var chunk = stream.node.contents.slice(position, position + length);
      var ab = WORKERFS.reader.readAsArrayBuffer(chunk);
      buffer.set(new Uint8Array(ab), offset);
      return chunk.size
    },
    write: function (stream, buffer, offset, length, position) {
      throw new FS.ErrnoError(29)
    },
    llseek: function (stream, offset, whence) {
      var position = offset;
      if (whence === 1) {
        position += stream.position
      } else if (whence === 2) {
        if (FS.isFile(stream.node.mode)) {
          position += stream.node.size
        }
      }
      if (position < 0) {
        throw new FS.ErrnoError(28)
      }
      return position
    }
  }
};
var FS = {
  root: null,
  mounts: [],
  devices: {},
  streams: [],
  nextInode: 1,
  nameTable: null,
  currentPath: "/",
  initialized: false,
  ignorePermissions: true,
  trackingDelegate: {},
  tracking: {
    openFlags: {
      READ: 1,
      WRITE: 2
    }
  },
  ErrnoError: null,
  genericErrors: {},
  filesystems: null,
  syncFSRequests: 0,
  handleFSError: function (e) {
    if (!(e instanceof FS.ErrnoError)) throw e + " : " + stackTrace();
    return ___setErrNo(e.errno)
  },
  lookupPath: function (path, opts) {
    path = PATH_FS.resolve(FS.cwd(), path);
    opts = opts || {};
    if (!path) return {
      path: "",
      node: null
    };
    var defaults = {
      follow_mount: true,
      recurse_count: 0
    };
    for (var key in defaults) {
      if (opts[key] === undefined) {
        opts[key] = defaults[key]
      }
    }
    if (opts.recurse_count > 8) {
      throw new FS.ErrnoError(32)
    }
    var parts = PATH.normalizeArray(path.split("/").filter(function (p) {
      return !!p
    }), false);
    var current = FS.root;
    var current_path = "/";
    for (var i = 0; i < parts.length; i++) {
      var islast = i === parts.length - 1;
      if (islast && opts.parent) {
        break
      }
      current = FS.lookupNode(current, parts[i]);
      current_path = PATH.join2(current_path, parts[i]);
      if (FS.isMountpoint(current)) {
        if (!islast || islast && opts.follow_mount) {
          current = current.mounted.root
        }
      }
      if (!islast || opts.follow) {
        var count = 0;
        while (FS.isLink(current.mode)) {
          var link = FS.readlink(current_path);
          current_path = PATH_FS.resolve(PATH.dirname(current_path), link);
          var lookup = FS.lookupPath(current_path, {
            recurse_count: opts.recurse_count
          });
          current = lookup.node;
          if (count++ > 40) {
            throw new FS.ErrnoError(32)
          }
        }
      }
    }
    return {
      path: current_path,
      node: current
    }
  },
  getPath: function (node) {
    var path;
    while (true) {
      if (FS.isRoot(node)) {
        var mount = node.mount.mountpoint;
        if (!path) return mount;
        return mount[mount.length - 1] !== "/" ? mount + "/" + path : mount + path
      }
      path = path ? node.name + "/" + path : node.name;
      node = node.parent
    }
  },
  hashName: function (parentid, name) {
    var hash = 0;
    for (var i = 0; i < name.length; i++) {
      hash = (hash << 5) - hash + name.charCodeAt(i) | 0
    }
    return (parentid + hash >>> 0) % FS.nameTable.length
  },
  hashAddNode: function (node) {
    var hash = FS.hashName(node.parent.id, node.name);
    node.name_next = FS.nameTable[hash];
    FS.nameTable[hash] = node
  },
  hashRemoveNode: function (node) {
    var hash = FS.hashName(node.parent.id, node.name);
    if (FS.nameTable[hash] === node) {
      FS.nameTable[hash] = node.name_next
    } else {
      var current = FS.nameTable[hash];
      while (current) {
        if (current.name_next === node) {
          current.name_next = node.name_next;
          break
        }
        current = current.name_next
      }
    }
  },
  lookupNode: function (parent, name) {
    var err = FS.mayLookup(parent);
    if (err) {
      throw new FS.ErrnoError(err, parent)
    }
    var hash = FS.hashName(parent.id, name);
    for (var node = FS.nameTable[hash]; node; node = node.name_next) {
      var nodeName = node.name;
      if (node.parent.id === parent.id && nodeName === name) {
        return node
      }
    }
    return FS.lookup(parent, name)
  },
  createNode: function (parent, name, mode, rdev) {
    if (!FS.FSNode) {
      FS.FSNode = function (parent, name, mode, rdev) {
        if (!parent) {
          parent = this
        }
        this.parent = parent;
        this.mount = parent.mount;
        this.mounted = null;
        this.id = FS.nextInode++;
        this.name = name;
        this.mode = mode;
        this.node_ops = {};
        this.stream_ops = {};
        this.rdev = rdev
      };
      FS.FSNode.prototype = {};
      var readMode = 292 | 73;
      var writeMode = 146;
      Object.defineProperties(FS.FSNode.prototype, {
        read: {
          get: function () {
            return (this.mode & readMode) === readMode
          },
          set: function (val) {
            val ? this.mode |= readMode : this.mode &= ~readMode
          }
        },
        write: {
          get: function () {
            return (this.mode & writeMode) === writeMode
          },
          set: function (val) {
            val ? this.mode |= writeMode : this.mode &= ~writeMode
          }
        },
        isFolder: {
          get: function () {
            return FS.isDir(this.mode)
          }
        },
        isDevice: {
          get: function () {
            return FS.isChrdev(this.mode)
          }
        }
      })
    }
    var node = new FS.FSNode(parent, name, mode, rdev);
    FS.hashAddNode(node);
    return node
  },
  destroyNode: function (node) {
    FS.hashRemoveNode(node)
  },
  isRoot: function (node) {
    return node === node.parent
  },
  isMountpoint: function (node) {
    return !!node.mounted
  },
  isFile: function (mode) {
    return (mode & 61440) === 32768
  },
  isDir: function (mode) {
    return (mode & 61440) === 16384
  },
  isLink: function (mode) {
    return (mode & 61440) === 40960
  },
  isChrdev: function (mode) {
    return (mode & 61440) === 8192
  },
  isBlkdev: function (mode) {
    return (mode & 61440) === 24576
  },
  isFIFO: function (mode) {
    return (mode & 61440) === 4096
  },
  isSocket: function (mode) {
    return (mode & 49152) === 49152
  },
  flagModes: {
    "r": 0,
    "rs": 1052672,
    "r+": 2,
    "w": 577,
    "wx": 705,
    "xw": 705,
    "w+": 578,
    "wx+": 706,
    "xw+": 706,
    "a": 1089,
    "ax": 1217,
    "xa": 1217,
    "a+": 1090,
    "ax+": 1218,
    "xa+": 1218
  },
  modeStringToFlags: function (str) {
    var flags = FS.flagModes[str];
    if (typeof flags === "undefined") {
      throw new Error("Unknown file open mode: " + str)
    }
    return flags
  },
  flagsToPermissionString: function (flag) {
    var perms = ["r", "w", "rw"][flag & 3];
    if (flag & 512) {
      perms += "w"
    }
    return perms
  },
  nodePermissions: function (node, perms) {
    if (FS.ignorePermissions) {
      return 0
    }
    if (perms.indexOf("r") !== -1 && !(node.mode & 292)) {
      return 2
    } else if (perms.indexOf("w") !== -1 && !(node.mode & 146)) {
      return 2
    } else if (perms.indexOf("x") !== -1 && !(node.mode & 73)) {
      return 2
    }
    return 0
  },
  mayLookup: function (dir) {
    var err = FS.nodePermissions(dir, "x");
    if (err) return err;
    if (!dir.node_ops.lookup) return 2;
    return 0
  },
  mayCreate: function (dir, name) {
    try {
      var node = FS.lookupNode(dir, name);
      return 20
    } catch (e) { }
    return FS.nodePermissions(dir, "wx")
  },
  mayDelete: function (dir, name, isdir) {
    var node;
    try {
      node = FS.lookupNode(dir, name)
    } catch (e) {
      return e.errno
    }
    var err = FS.nodePermissions(dir, "wx");
    if (err) {
      return err
    }
    if (isdir) {
      if (!FS.isDir(node.mode)) {
        return 54
      }
      if (FS.isRoot(node) || FS.getPath(node) === FS.cwd()) {
        return 10
      }
    } else {
      if (FS.isDir(node.mode)) {
        return 31
      }
    }
    return 0
  },
  mayOpen: function (node, flags) {
    if (!node) {
      return 44
    }
    if (FS.isLink(node.mode)) {
      return 32
    } else if (FS.isDir(node.mode)) {
      if (FS.flagsToPermissionString(flags) !== "r" || flags & 512) {
        return 31
      }
    }
    return FS.nodePermissions(node, FS.flagsToPermissionString(flags))
  },
  MAX_OPEN_FDS: 4096,
  nextfd: function (fd_start, fd_end) {
    fd_start = fd_start || 0;
    fd_end = fd_end || FS.MAX_OPEN_FDS;
    for (var fd = fd_start; fd <= fd_end; fd++) {
      if (!FS.streams[fd]) {
        return fd
      }
    }
    throw new FS.ErrnoError(33)
  },
  getStream: function (fd) {
    return FS.streams[fd]
  },
  createStream: function (stream, fd_start, fd_end) {
    if (!FS.FSStream) {
      FS.FSStream = function () { };
      FS.FSStream.prototype = {};
      Object.defineProperties(FS.FSStream.prototype, {
        object: {
          get: function () {
            return this.node
          },
          set: function (val) {
            this.node = val
          }
        },
        isRead: {
          get: function () {
            return (this.flags & 2097155) !== 1
          }
        },
        isWrite: {
          get: function () {
            return (this.flags & 2097155) !== 0
          }
        },
        isAppend: {
          get: function () {
            return this.flags & 1024
          }
        }
      })
    }
    var newStream = new FS.FSStream;
    for (var p in stream) {
      newStream[p] = stream[p]
    }
    stream = newStream;
    var fd = FS.nextfd(fd_start, fd_end);
    stream.fd = fd;
    FS.streams[fd] = stream;
    return stream
  },
  closeStream: function (fd) {
    FS.streams[fd] = null
  },
  chrdev_stream_ops: {
    open: function (stream) {
      var device = FS.getDevice(stream.node.rdev);
      stream.stream_ops = device.stream_ops;
      if (stream.stream_ops.open) {
        stream.stream_ops.open(stream)
      }
    },
    llseek: function () {
      throw new FS.ErrnoError(70)
    }
  },
  major: function (dev) {
    return dev >> 8
  },
  minor: function (dev) {
    return dev & 255
  },
  makedev: function (ma, mi) {
    return ma << 8 | mi
  },
  registerDevice: function (dev, ops) {
    FS.devices[dev] = {
      stream_ops: ops
    }
  },
  getDevice: function (dev) {
    return FS.devices[dev]
  },
  getMounts: function (mount) {
    var mounts = [];
    var check = [mount];
    while (check.length) {
      var m = check.pop();
      mounts.push(m);
      check.push.apply(check, m.mounts)
    }
    return mounts
  },
  syncfs: function (populate, callback) {
    if (typeof populate === "function") {
      callback = populate;
      populate = false
    }
    FS.syncFSRequests++;
    if (FS.syncFSRequests > 1) {
      console.log("warning: " + FS.syncFSRequests + " FS.syncfs operations in flight at once, probably just doing extra work")
    }
    var mounts = FS.getMounts(FS.root.mount);
    var completed = 0;

    function doCallback(err) {
      FS.syncFSRequests--;
      return callback(err)
    }

    function done(err) {
      if (err) {
        if (!done.errored) {
          done.errored = true;
          return doCallback(err)
        }
        return
      }
      if (++completed >= mounts.length) {
        doCallback(null)
      }
    }
    mounts.forEach(function (mount) {
      if (!mount.type.syncfs) {
        return done(null)
      }
      mount.type.syncfs(mount, populate, done)
    })
  },
  mount: function (type, opts, mountpoint) {
    var root = mountpoint === "/";
    var pseudo = !mountpoint;
    var node;
    if (root && FS.root) {
      throw new FS.ErrnoError(10)
    } else if (!root && !pseudo) {
      var lookup = FS.lookupPath(mountpoint, {
        follow_mount: false
      });
      mountpoint = lookup.path;
      node = lookup.node;
      if (FS.isMountpoint(node)) {
        throw new FS.ErrnoError(10)
      }
      if (!FS.isDir(node.mode)) {
        throw new FS.ErrnoError(54)
      }
    }
    var mount = {
      type: type,
      opts: opts,
      mountpoint: mountpoint,
      mounts: []
    };
    var mountRoot = type.mount(mount);
    mountRoot.mount = mount;
    mount.root = mountRoot;
    if (root) {
      FS.root = mountRoot
    } else if (node) {
      node.mounted = mount;
      if (node.mount) {
        node.mount.mounts.push(mount)
      }
    }
    return mountRoot
  },
  unmount: function (mountpoint) {
    var lookup = FS.lookupPath(mountpoint, {
      follow_mount: false
    });
    if (!FS.isMountpoint(lookup.node)) {
      throw new FS.ErrnoError(28)
    }
    var node = lookup.node;
    var mount = node.mounted;
    var mounts = FS.getMounts(mount);
    Object.keys(FS.nameTable).forEach(function (hash) {
      var current = FS.nameTable[hash];
      while (current) {
        var next = current.name_next;
        if (mounts.indexOf(current.mount) !== -1) {
          FS.destroyNode(current)
        }
        current = next
      }
    });
    node.mounted = null;
    var idx = node.mount.mounts.indexOf(mount);
    node.mount.mounts.splice(idx, 1)
  },
  lookup: function (parent, name) {
    return parent.node_ops.lookup(parent, name)
  },
  mknod: function (path, mode, dev) {
    var lookup = FS.lookupPath(path, {
      parent: true
    });
    var parent = lookup.node;
    var name = PATH.basename(path);
    if (!name || name === "." || name === "..") {
      throw new FS.ErrnoError(28)
    }
    var err = FS.mayCreate(parent, name);
    if (err) {
      throw new FS.ErrnoError(err)
    }
    if (!parent.node_ops.mknod) {
      throw new FS.ErrnoError(63)
    }
    return parent.node_ops.mknod(parent, name, mode, dev)
  },
  create: function (path, mode) {
    mode = mode !== undefined ? mode : 438;
    mode &= 4095;
    mode |= 32768;
    return FS.mknod(path, mode, 0)
  },
  mkdir: function (path, mode) {
    mode = mode !== undefined ? mode : 511;
    mode &= 511 | 512;
    mode |= 16384;
    return FS.mknod(path, mode, 0)
  },
  mkdirTree: function (path, mode) {
    var dirs = path.split("/");
    var d = "";
    for (var i = 0; i < dirs.length; ++i) {
      if (!dirs[i]) continue;
      d += "/" + dirs[i];
      try {
        FS.mkdir(d, mode)
      } catch (e) {
        if (e.errno != 20) throw e
      }
    }
  },
  mkdev: function (path, mode, dev) {
    if (typeof dev === "undefined") {
      dev = mode;
      mode = 438
    }
    mode |= 8192;
    return FS.mknod(path, mode, dev)
  },
  symlink: function (oldpath, newpath) {
    if (!PATH_FS.resolve(oldpath)) {
      throw new FS.ErrnoError(44)
    }
    var lookup = FS.lookupPath(newpath, {
      parent: true
    });
    var parent = lookup.node;
    if (!parent) {
      throw new FS.ErrnoError(44)
    }
    var newname = PATH.basename(newpath);
    var err = FS.mayCreate(parent, newname);
    if (err) {
      throw new FS.ErrnoError(err)
    }
    if (!parent.node_ops.symlink) {
      throw new FS.ErrnoError(63)
    }
    return parent.node_ops.symlink(parent, newname, oldpath)
  },
  rename: function (old_path, new_path) {
    var old_dirname = PATH.dirname(old_path);
    var new_dirname = PATH.dirname(new_path);
    var old_name = PATH.basename(old_path);
    var new_name = PATH.basename(new_path);
    var lookup, old_dir, new_dir;
    try {
      lookup = FS.lookupPath(old_path, {
        parent: true
      });
      old_dir = lookup.node;
      lookup = FS.lookupPath(new_path, {
        parent: true
      });
      new_dir = lookup.node
    } catch (e) {
      throw new FS.ErrnoError(10)
    }
    if (!old_dir || !new_dir) throw new FS.ErrnoError(44);
    if (old_dir.mount !== new_dir.mount) {
      throw new FS.ErrnoError(75)
    }
    var old_node = FS.lookupNode(old_dir, old_name);
    var relative = PATH_FS.relative(old_path, new_dirname);
    if (relative.charAt(0) !== ".") {
      throw new FS.ErrnoError(28)
    }
    relative = PATH_FS.relative(new_path, old_dirname);
    if (relative.charAt(0) !== ".") {
      throw new FS.ErrnoError(55)
    }
    var new_node;
    try {
      new_node = FS.lookupNode(new_dir, new_name)
    } catch (e) { }
    if (old_node === new_node) {
      return
    }
    var isdir = FS.isDir(old_node.mode);
    var err = FS.mayDelete(old_dir, old_name, isdir);
    if (err) {
      throw new FS.ErrnoError(err)
    }
    err = new_node ? FS.mayDelete(new_dir, new_name, isdir) : FS.mayCreate(new_dir, new_name);
    if (err) {
      throw new FS.ErrnoError(err)
    }
    if (!old_dir.node_ops.rename) {
      throw new FS.ErrnoError(63)
    }
    if (FS.isMountpoint(old_node) || new_node && FS.isMountpoint(new_node)) {
      throw new FS.ErrnoError(10)
    }
    if (new_dir !== old_dir) {
      err = FS.nodePermissions(old_dir, "w");
      if (err) {
        throw new FS.ErrnoError(err)
      }
    }
    try {
      if (FS.trackingDelegate["willMovePath"]) {
        FS.trackingDelegate["willMovePath"](old_path, new_path)
      }
    } catch (e) {
      console.log("FS.trackingDelegate['willMovePath']('" + old_path + "', '" + new_path + "') threw an exception: " + e.message)
    }
    FS.hashRemoveNode(old_node);
    try {
      old_dir.node_ops.rename(old_node, new_dir, new_name)
    } catch (e) {
      throw e
    } finally {
      FS.hashAddNode(old_node)
    }
    try {
      if (FS.trackingDelegate["onMovePath"]) FS.trackingDelegate["onMovePath"](old_path, new_path)
    } catch (e) {
      console.log("FS.trackingDelegate['onMovePath']('" + old_path + "', '" + new_path + "') threw an exception: " + e.message)
    }
  },
  rmdir: function (path) {
    var lookup = FS.lookupPath(path, {
      parent: true
    });
    var parent = lookup.node;
    var name = PATH.basename(path);
    var node = FS.lookupNode(parent, name);
    var err = FS.mayDelete(parent, name, true);
    if (err) {
      throw new FS.ErrnoError(err)
    }
    if (!parent.node_ops.rmdir) {
      throw new FS.ErrnoError(63)
    }
    if (FS.isMountpoint(node)) {
      throw new FS.ErrnoError(10)
    }
    try {
      if (FS.trackingDelegate["willDeletePath"]) {
        FS.trackingDelegate["willDeletePath"](path)
      }
    } catch (e) {
      console.log("FS.trackingDelegate['willDeletePath']('" + path + "') threw an exception: " + e.message)
    }
    parent.node_ops.rmdir(parent, name);
    FS.destroyNode(node);
    try {
      if (FS.trackingDelegate["onDeletePath"]) FS.trackingDelegate["onDeletePath"](path)
    } catch (e) {
      console.log("FS.trackingDelegate['onDeletePath']('" + path + "') threw an exception: " + e.message)
    }
  },
  readdir: function (path) {
    var lookup = FS.lookupPath(path, {
      follow: true
    });
    var node = lookup.node;
    if (!node.node_ops.readdir) {
      throw new FS.ErrnoError(54)
    }
    return node.node_ops.readdir(node)
  },
  unlink: function (path) {
    var lookup = FS.lookupPath(path, {
      parent: true
    });
    var parent = lookup.node;
    var name = PATH.basename(path);
    var node = FS.lookupNode(parent, name);
    var err = FS.mayDelete(parent, name, false);
    if (err) {
      throw new FS.ErrnoError(err)
    }
    if (!parent.node_ops.unlink) {
      throw new FS.ErrnoError(63)
    }
    if (FS.isMountpoint(node)) {
      throw new FS.ErrnoError(10)
    }
    try {
      if (FS.trackingDelegate["willDeletePath"]) {
        FS.trackingDelegate["willDeletePath"](path)
      }
    } catch (e) {
      console.log("FS.trackingDelegate['willDeletePath']('" + path + "') threw an exception: " + e.message)
    }
    parent.node_ops.unlink(parent, name);
    FS.destroyNode(node);
    try {
      if (FS.trackingDelegate["onDeletePath"]) FS.trackingDelegate["onDeletePath"](path)
    } catch (e) {
      console.log("FS.trackingDelegate['onDeletePath']('" + path + "') threw an exception: " + e.message)
    }
  },
  readlink: function (path) {
    var lookup = FS.lookupPath(path);
    var link = lookup.node;
    if (!link) {
      throw new FS.ErrnoError(44)
    }
    if (!link.node_ops.readlink) {
      throw new FS.ErrnoError(28)
    }
    return PATH_FS.resolve(FS.getPath(link.parent), link.node_ops.readlink(link))
  },
  stat: function (path, dontFollow) {
    var lookup = FS.lookupPath(path, {
      follow: !dontFollow
    });
    var node = lookup.node;
    if (!node) {
      throw new FS.ErrnoError(44)
    }
    if (!node.node_ops.getattr) {
      throw new FS.ErrnoError(63)
    }
    return node.node_ops.getattr(node)
  },
  lstat: function (path) {
    return FS.stat(path, true)
  },
  chmod: function (path, mode, dontFollow) {
    var node;
    if (typeof path === "string") {
      var lookup = FS.lookupPath(path, {
        follow: !dontFollow
      });
      node = lookup.node
    } else {
      node = path
    }
    if (!node.node_ops.setattr) {
      throw new FS.ErrnoError(63)
    }
    node.node_ops.setattr(node, {
      mode: mode & 4095 | node.mode & ~4095,
      timestamp: Date.now()
    })
  },
  lchmod: function (path, mode) {
    FS.chmod(path, mode, true)
  },
  fchmod: function (fd, mode) {
    var stream = FS.getStream(fd);
    if (!stream) {
      throw new FS.ErrnoError(8)
    }
    FS.chmod(stream.node, mode)
  },
  chown: function (path, uid, gid, dontFollow) {
    var node;
    if (typeof path === "string") {
      var lookup = FS.lookupPath(path, {
        follow: !dontFollow
      });
      node = lookup.node
    } else {
      node = path
    }
    if (!node.node_ops.setattr) {
      throw new FS.ErrnoError(63)
    }
    node.node_ops.setattr(node, {
      timestamp: Date.now()
    })
  },
  lchown: function (path, uid, gid) {
    FS.chown(path, uid, gid, true)
  },
  fchown: function (fd, uid, gid) {
    var stream = FS.getStream(fd);
    if (!stream) {
      throw new FS.ErrnoError(8)
    }
    FS.chown(stream.node, uid, gid)
  },
  truncate: function (path, len) {
    if (len < 0) {
      throw new FS.ErrnoError(28)
    }
    var node;
    if (typeof path === "string") {
      var lookup = FS.lookupPath(path, {
        follow: true
      });
      node = lookup.node
    } else {
      node = path
    }
    if (!node.node_ops.setattr) {
      throw new FS.ErrnoError(63)
    }
    if (FS.isDir(node.mode)) {
      throw new FS.ErrnoError(31)
    }
    if (!FS.isFile(node.mode)) {
      throw new FS.ErrnoError(28)
    }
    var err = FS.nodePermissions(node, "w");
    if (err) {
      throw new FS.ErrnoError(err)
    }
    node.node_ops.setattr(node, {
      size: len,
      timestamp: Date.now()
    })
  },
  ftruncate: function (fd, len) {
    var stream = FS.getStream(fd);
    if (!stream) {
      throw new FS.ErrnoError(8)
    }
    if ((stream.flags & 2097155) === 0) {
      throw new FS.ErrnoError(28)
    }
    FS.truncate(stream.node, len)
  },
  utime: function (path, atime, mtime) {
    var lookup = FS.lookupPath(path, {
      follow: true
    });
    var node = lookup.node;
    node.node_ops.setattr(node, {
      timestamp: Math.max(atime, mtime)
    })
  },
  open: function (path, flags, mode, fd_start, fd_end) {
    if (path === "") {
      throw new FS.ErrnoError(44)
    }
    flags = typeof flags === "string" ? FS.modeStringToFlags(flags) : flags;
    mode = typeof mode === "undefined" ? 438 : mode;
    if (flags & 64) {
      mode = mode & 4095 | 32768
    } else {
      mode = 0
    }
    var node;
    if (typeof path === "object") {
      node = path
    } else {
      path = PATH.normalize(path);
      try {
        var lookup = FS.lookupPath(path, {
          follow: !(flags & 131072)
        });
        node = lookup.node
      } catch (e) { }
    }
    var created = false;
    if (flags & 64) {
      if (node) {
        if (flags & 128) {
          throw new FS.ErrnoError(20)
        }
      } else {
        node = FS.mknod(path, mode, 0);
        created = true
      }
    }
    if (!node) {
      throw new FS.ErrnoError(44)
    }
    if (FS.isChrdev(node.mode)) {
      flags &= ~512
    }
    if (flags & 65536 && !FS.isDir(node.mode)) {
      throw new FS.ErrnoError(54)
    }
    if (!created) {
      var err = FS.mayOpen(node, flags);
      if (err) {
        throw new FS.ErrnoError(err)
      }
    }
    if (flags & 512) {
      FS.truncate(node, 0)
    }
    flags &= ~(128 | 512);
    var stream = FS.createStream({
      node: node,
      path: FS.getPath(node),
      flags: flags,
      seekable: true,
      position: 0,
      stream_ops: node.stream_ops,
      ungotten: [],
      error: false
    }, fd_start, fd_end);
    if (stream.stream_ops.open) {
      stream.stream_ops.open(stream)
    }
    if (Module["logReadFiles"] && !(flags & 1)) {
      if (!FS.readFiles) FS.readFiles = {};
      if (!(path in FS.readFiles)) {
        FS.readFiles[path] = 1;
        console.log("FS.trackingDelegate error on read file: " + path)
      }
    }
    try {
      if (FS.trackingDelegate["onOpenFile"]) {
        var trackingFlags = 0;
        if ((flags & 2097155) !== 1) {
          trackingFlags |= FS.tracking.openFlags.READ
        }
        if ((flags & 2097155) !== 0) {
          trackingFlags |= FS.tracking.openFlags.WRITE
        }
        FS.trackingDelegate["onOpenFile"](path, trackingFlags)
      }
    } catch (e) {
      console.log("FS.trackingDelegate['onOpenFile']('" + path + "', flags) threw an exception: " + e.message)
    }
    return stream
  },
  close: function (stream) {
    if (FS.isClosed(stream)) {
      throw new FS.ErrnoError(8)
    }
    if (stream.getdents) stream.getdents = null;
    try {
      if (stream.stream_ops.close) {
        stream.stream_ops.close(stream)
      }
    } catch (e) {
      throw e
    } finally {
      FS.closeStream(stream.fd)
    }
    stream.fd = null
  },
  isClosed: function (stream) {
    return stream.fd === null
  },
  llseek: function (stream, offset, whence) {
    if (FS.isClosed(stream)) {
      throw new FS.ErrnoError(8)
    }
    if (!stream.seekable || !stream.stream_ops.llseek) {
      throw new FS.ErrnoError(70)
    }
    if (whence != 0 && whence != 1 && whence != 2) {
      throw new FS.ErrnoError(28)
    }
    stream.position = stream.stream_ops.llseek(stream, offset, whence);
    stream.ungotten = [];
    return stream.position
  },
  read: function (stream, buffer, offset, length, position) {
    if (length < 0 || position < 0) {
      throw new FS.ErrnoError(28)
    }
    if (FS.isClosed(stream)) {
      throw new FS.ErrnoError(8)
    }
    if ((stream.flags & 2097155) === 1) {
      throw new FS.ErrnoError(8)
    }
    if (FS.isDir(stream.node.mode)) {
      throw new FS.ErrnoError(31)
    }
    if (!stream.stream_ops.read) {
      throw new FS.ErrnoError(28)
    }
    var seeking = typeof position !== "undefined";
    if (!seeking) {
      position = stream.position
    } else if (!stream.seekable) {
      throw new FS.ErrnoError(70)
    }
    var bytesRead = stream.stream_ops.read(stream, buffer, offset, length, position);
    if (!seeking) stream.position += bytesRead;
    return bytesRead
  },
  write: function (stream, buffer, offset, length, position, canOwn) {
    if (length < 0 || position < 0) {
      throw new FS.ErrnoError(28)
    }
    if (FS.isClosed(stream)) {
      throw new FS.ErrnoError(8)
    }
    if ((stream.flags & 2097155) === 0) {
      throw new FS.ErrnoError(8)
    }
    if (FS.isDir(stream.node.mode)) {
      throw new FS.ErrnoError(31)
    }
    if (!stream.stream_ops.write) {
      throw new FS.ErrnoError(28)
    }
    if (stream.flags & 1024) {
      FS.llseek(stream, 0, 2)
    }
    var seeking = typeof position !== "undefined";
    if (!seeking) {
      position = stream.position
    } else if (!stream.seekable) {
      throw new FS.ErrnoError(70)
    }
    var bytesWritten = stream.stream_ops.write(stream, buffer, offset, length, position, canOwn);
    if (!seeking) stream.position += bytesWritten;
    try {
      if (stream.path && FS.trackingDelegate["onWriteToFile"]) FS.trackingDelegate["onWriteToFile"](stream.path)
    } catch (e) {
      console.log("FS.trackingDelegate['onWriteToFile']('" + stream.path + "') threw an exception: " + e.message)
    }
    return bytesWritten
  },
  allocate: function (stream, offset, length) {
    if (FS.isClosed(stream)) {
      throw new FS.ErrnoError(8)
    }
    if (offset < 0 || length <= 0) {
      throw new FS.ErrnoError(28)
    }
    if ((stream.flags & 2097155) === 0) {
      throw new FS.ErrnoError(8)
    }
    if (!FS.isFile(stream.node.mode) && !FS.isDir(stream.node.mode)) {
      throw new FS.ErrnoError(43)
    }
    if (!stream.stream_ops.allocate) {
      throw new FS.ErrnoError(138)
    }
    stream.stream_ops.allocate(stream, offset, length)
  },
  mmap: function (stream, buffer, offset, length, position, prot, flags) {
    if ((prot & 2) !== 0 && (flags & 2) === 0 && (stream.flags & 2097155) !== 2) {
      throw new FS.ErrnoError(2)
    }
    if ((stream.flags & 2097155) === 1) {
      throw new FS.ErrnoError(2)
    }
    if (!stream.stream_ops.mmap) {
      throw new FS.ErrnoError(43)
    }
    return stream.stream_ops.mmap(stream, buffer, offset, length, position, prot, flags)
  },
  msync: function (stream, buffer, offset, length, mmapFlags) {
    if (!stream || !stream.stream_ops.msync) {
      return 0
    }
    return stream.stream_ops.msync(stream, buffer, offset, length, mmapFlags)
  },
  munmap: function (stream) {
    return 0
  },
  ioctl: function (stream, cmd, arg) {
    if (!stream.stream_ops.ioctl) {
      throw new FS.ErrnoError(59)
    }
    return stream.stream_ops.ioctl(stream, cmd, arg)
  },
  readFile: function (path, opts) {
    opts = opts || {};
    opts.flags = opts.flags || "r";
    opts.encoding = opts.encoding || "binary";
    if (opts.encoding !== "utf8" && opts.encoding !== "binary") {
      throw new Error('Invalid encoding type "' + opts.encoding + '"')
    }
    var ret;
    var stream = FS.open(path, opts.flags);
    var stat = FS.stat(path);
    var length = stat.size;
    var buf = new Uint8Array(length);
    FS.read(stream, buf, 0, length, 0);
    if (opts.encoding === "utf8") {
      ret = UTF8ArrayToString(buf, 0)
    } else if (opts.encoding === "binary") {
      ret = buf
    }
    FS.close(stream);
    return ret
  },
  writeFile: function (path, data, opts) {
    opts = opts || {};
    opts.flags = opts.flags || "w";
    var stream = FS.open(path, opts.flags, opts.mode);
    if (typeof data === "string") {
      var buf = new Uint8Array(lengthBytesUTF8(data) + 1);
      var actualNumBytes = stringToUTF8Array(data, buf, 0, buf.length);
      FS.write(stream, buf, 0, actualNumBytes, undefined, opts.canOwn)
    } else if (ArrayBuffer.isView(data)) {
      FS.write(stream, data, 0, data.byteLength, undefined, opts.canOwn)
    } else {
      throw new Error("Unsupported data type")
    }
    FS.close(stream)
  },
  cwd: function () {
    return FS.currentPath
  },
  chdir: function (path) {
    var lookup = FS.lookupPath(path, {
      follow: true
    });
    if (lookup.node === null) {
      throw new FS.ErrnoError(44)
    }
    if (!FS.isDir(lookup.node.mode)) {
      throw new FS.ErrnoError(54)
    }
    var err = FS.nodePermissions(lookup.node, "x");
    if (err) {
      throw new FS.ErrnoError(err)
    }
    FS.currentPath = lookup.path
  },
  createDefaultDirectories: function () {
    FS.mkdir("/tmp");
    FS.mkdir("/home");
    FS.mkdir("/home/web_user")
  },
  createDefaultDevices: function () {
    FS.mkdir("/dev");
    FS.registerDevice(FS.makedev(1, 3), {
      read: function () {
        return 0
      },
      write: function (stream, buffer, offset, length, pos) {
        return length
      }
    });
    FS.mkdev("/dev/null", FS.makedev(1, 3));
    TTY.register(FS.makedev(5, 0), TTY.default_tty_ops);
    TTY.register(FS.makedev(6, 0), TTY.default_tty1_ops);
    FS.mkdev("/dev/tty", FS.makedev(5, 0));
    FS.mkdev("/dev/tty1", FS.makedev(6, 0));
    var random_device;
    if (typeof crypto === "object" && typeof crypto["getRandomValues"] === "function") {
      var randomBuffer = new Uint8Array(1);
      random_device = function () {
        crypto.getRandomValues(randomBuffer);
        return randomBuffer[0]
      }
    } else if (ENVIRONMENT_IS_NODE) {
      try {
        var crypto_module = require("crypto");
        random_device = function () {
          return crypto_module["randomBytes"](1)[0]
        }
      } catch (e) { }
    } else { }
    if (!random_device) {
      random_device = function () {
        abort("random_device")
      }
    }
    FS.createDevice("/dev", "random", random_device);
    FS.createDevice("/dev", "urandom", random_device);
    FS.mkdir("/dev/shm");
    FS.mkdir("/dev/shm/tmp")
  },
  createSpecialDirectories: function () {
    FS.mkdir("/proc");
    FS.mkdir("/proc/self");
    FS.mkdir("/proc/self/fd");
    FS.mount({
      mount: function () {
        var node = FS.createNode("/proc/self", "fd", 16384 | 511, 73);
        node.node_ops = {
          lookup: function (parent, name) {
            var fd = +name;
            var stream = FS.getStream(fd);
            if (!stream) throw new FS.ErrnoError(8);
            var ret = {
              parent: null,
              mount: {
                mountpoint: "fake"
              },
              node_ops: {
                readlink: function () {
                  return stream.path
                }
              }
            };
            ret.parent = ret;
            return ret
          }
        };
        return node
      }
    }, {}, "/proc/self/fd")
  },
  createStandardStreams: function () {
    if (Module["stdin"]) {
      FS.createDevice("/dev", "stdin", Module["stdin"])
    } else {
      FS.symlink("/dev/tty", "/dev/stdin")
    }
    if (Module["stdout"]) {
      FS.createDevice("/dev", "stdout", null, Module["stdout"])
    } else {
      FS.symlink("/dev/tty", "/dev/stdout")
    }
    if (Module["stderr"]) {
      FS.createDevice("/dev", "stderr", null, Module["stderr"])
    } else {
      FS.symlink("/dev/tty1", "/dev/stderr")
    }
    var stdin = FS.open("/dev/stdin", "r");
    var stdout = FS.open("/dev/stdout", "w");
    var stderr = FS.open("/dev/stderr", "w")
  },
  ensureErrnoError: function () {
    if (FS.ErrnoError) return;
    FS.ErrnoError = function ErrnoError(errno, node) {
      this.node = node;
      this.setErrno = function (errno) {
        this.errno = errno
      };
      this.setErrno(errno);
      this.message = "FS error"
    };
    FS.ErrnoError.prototype = new Error;
    FS.ErrnoError.prototype.constructor = FS.ErrnoError;
    [44].forEach(function (code) {
      FS.genericErrors[code] = new FS.ErrnoError(code);
      FS.genericErrors[code].stack = "<generic error, no stack>"
    })
  },
  staticInit: function () {
    FS.ensureErrnoError();
    FS.nameTable = new Array(4096);
    FS.mount(MEMFS, {}, "/");
    FS.createDefaultDirectories();
    FS.createDefaultDevices();
    FS.createSpecialDirectories();
    FS.filesystems = {
      "MEMFS": MEMFS,
      "IDBFS": IDBFS,
      "NODEFS": NODEFS,
      "WORKERFS": WORKERFS
    }
  },
  init: function (input, output, error) {
    FS.init.initialized = true;
    FS.ensureErrnoError();
    Module["stdin"] = input || Module["stdin"];
    Module["stdout"] = output || Module["stdout"];
    Module["stderr"] = error || Module["stderr"];
    FS.createStandardStreams()
  },
  quit: function () {
    FS.init.initialized = false;
    var fflush = Module["_fflush"];
    if (fflush) fflush(0);
    for (var i = 0; i < FS.streams.length; i++) {
      var stream = FS.streams[i];
      if (!stream) {
        continue
      }
      FS.close(stream)
    }
  },
  getMode: function (canRead, canWrite) {
    var mode = 0;
    if (canRead) mode |= 292 | 73;
    if (canWrite) mode |= 146;
    return mode
  },
  joinPath: function (parts, forceRelative) {
    var path = PATH.join.apply(null, parts);
    if (forceRelative && path[0] == "/") path = path.substr(1);
    return path
  },
  absolutePath: function (relative, base) {
    return PATH_FS.resolve(base, relative)
  },
  standardizePath: function (path) {
    return PATH.normalize(path)
  },
  findObject: function (path, dontResolveLastLink) {
    var ret = FS.analyzePath(path, dontResolveLastLink);
    if (ret.exists) {
      return ret.object
    } else {
      ___setErrNo(ret.error);
      return null
    }
  },
  analyzePath: function (path, dontResolveLastLink) {
    try {
      var lookup = FS.lookupPath(path, {
        follow: !dontResolveLastLink
      });
      path = lookup.path
    } catch (e) { }
    var ret = {
      isRoot: false,
      exists: false,
      error: 0,
      name: null,
      path: null,
      object: null,
      parentExists: false,
      parentPath: null,
      parentObject: null
    };
    try {
      var lookup = FS.lookupPath(path, {
        parent: true
      });
      ret.parentExists = true;
      ret.parentPath = lookup.path;
      ret.parentObject = lookup.node;
      ret.name = PATH.basename(path);
      lookup = FS.lookupPath(path, {
        follow: !dontResolveLastLink
      });
      ret.exists = true;
      ret.path = lookup.path;
      ret.object = lookup.node;
      ret.name = lookup.node.name;
      ret.isRoot = lookup.path === "/"
    } catch (e) {
      ret.error = e.errno
    }
    return ret
  },
  createFolder: function (parent, name, canRead, canWrite) {
    var path = PATH.join2(typeof parent === "string" ? parent : FS.getPath(parent), name);
    var mode = FS.getMode(canRead, canWrite);
    return FS.mkdir(path, mode)
  },
  createPath: function (parent, path, canRead, canWrite) {
    parent = typeof parent === "string" ? parent : FS.getPath(parent);
    var parts = path.split("/").reverse();
    while (parts.length) {
      var part = parts.pop();
      if (!part) continue;
      var current = PATH.join2(parent, part);
      try {
        FS.mkdir(current)
      } catch (e) { }
      parent = current
    }
    return current
  },
  createFile: function (parent, name, properties, canRead, canWrite) {
    var path = PATH.join2(typeof parent === "string" ? parent : FS.getPath(parent), name);
    var mode = FS.getMode(canRead, canWrite);
    return FS.create(path, mode)
  },
  createDataFile: function (parent, name, data, canRead, canWrite, canOwn) {
    var path = name ? PATH.join2(typeof parent === "string" ? parent : FS.getPath(parent), name) : parent;
    var mode = FS.getMode(canRead, canWrite);
    var node = FS.create(path, mode);
    if (data) {
      if (typeof data === "string") {
        var arr = new Array(data.length);
        for (var i = 0, len = data.length; i < len; ++i) arr[i] = data.charCodeAt(i);
        data = arr
      }
      FS.chmod(node, mode | 146);
      var stream = FS.open(node, "w");
      FS.write(stream, data, 0, data.length, 0, canOwn);
      FS.close(stream);
      FS.chmod(node, mode)
    }
    return node
  },
  createDevice: function (parent, name, input, output) {
    var path = PATH.join2(typeof parent === "string" ? parent : FS.getPath(parent), name);
    var mode = FS.getMode(!!input, !!output);
    if (!FS.createDevice.major) FS.createDevice.major = 64;
    var dev = FS.makedev(FS.createDevice.major++, 0);
    FS.registerDevice(dev, {
      open: function (stream) {
        stream.seekable = false
      },
      close: function (stream) {
        if (output && output.buffer && output.buffer.length) {
          output(10)
        }
      },
      read: function (stream, buffer, offset, length, pos) {
        var bytesRead = 0;
        for (var i = 0; i < length; i++) {
          var result;
          try {
            result = input()
          } catch (e) {
            throw new FS.ErrnoError(29)
          }
          if (result === undefined && bytesRead === 0) {
            throw new FS.ErrnoError(6)
          }
          if (result === null || result === undefined) break;
          bytesRead++;
          buffer[offset + i] = result
        }
        if (bytesRead) {
          stream.node.timestamp = Date.now()
        }
        return bytesRead
      },
      write: function (stream, buffer, offset, length, pos) {
        for (var i = 0; i < length; i++) {
          try {
            output(buffer[offset + i])
          } catch (e) {
            throw new FS.ErrnoError(29)
          }
        }
        if (length) {
          stream.node.timestamp = Date.now()
        }
        return i
      }
    });
    return FS.mkdev(path, mode, dev)
  },
  createLink: function (parent, name, target, canRead, canWrite) {
    var path = PATH.join2(typeof parent === "string" ? parent : FS.getPath(parent), name);
    return FS.symlink(target, path)
  },
  forceLoadFile: function (obj) {
    if (obj.isDevice || obj.isFolder || obj.link || obj.contents) return true;
    var success = true;
    if (typeof XMLHttpRequest !== "undefined") {
      throw new Error("Lazy loading should have been performed (contents set) in createLazyFile, but it was not. Lazy loading only works in web workers. Use --embed-file or --preload-file in emcc on the main thread.")
    } else if (read_) {
      try {
        obj.contents = intArrayFromString(read_(obj.url), true);
        obj.usedBytes = obj.contents.length
      } catch (e) {
        success = false
      }
    } else {
      throw new Error("Cannot load without read() or XMLHttpRequest.")
    }
    if (!success) ___setErrNo(29);
    return success
  },
  createLazyFile: function (parent, name, url, canRead, canWrite) {
    function LazyUint8Array() {
      this.lengthKnown = false;
      this.chunks = []
    }
    LazyUint8Array.prototype.get = function LazyUint8Array_get(idx) {
      if (idx > this.length - 1 || idx < 0) {
        return undefined
      }
      var chunkOffset = idx % this.chunkSize;
      var chunkNum = idx / this.chunkSize | 0;
      return this.getter(chunkNum)[chunkOffset]
    };
    LazyUint8Array.prototype.setDataGetter = function LazyUint8Array_setDataGetter(getter) {
      this.getter = getter
    };
    LazyUint8Array.prototype.cacheLength = function LazyUint8Array_cacheLength() {
      var xhr = new XMLHttpRequest;
      xhr.open("HEAD", url, false);
      xhr.send(null);
      if (!(xhr.status >= 200 && xhr.status < 300 || xhr.status === 304)) throw new Error("Couldn't load " + url + ". Status: " + xhr.status);
      var datalength = Number(xhr.getResponseHeader("Content-length"));
      var header;
      var hasByteServing = (header = xhr.getResponseHeader("Accept-Ranges")) && header === "bytes";
      var usesGzip = (header = xhr.getResponseHeader("Content-Encoding")) && header === "gzip";
      var chunkSize = 1024 * 1024;
      if (!hasByteServing) chunkSize = datalength;
      var doXHR = function (from, to) {
        if (from > to) throw new Error("invalid range (" + from + ", " + to + ") or no bytes requested!");
        if (to > datalength - 1) throw new Error("only " + datalength + " bytes available! programmer error!");
        var xhr = new XMLHttpRequest;
        xhr.open("GET", url, false);
        if (datalength !== chunkSize) xhr.setRequestHeader("Range", "bytes=" + from + "-" + to);
        if (typeof Uint8Array != "undefined") xhr.responseType = "arraybuffer";
        if (xhr.overrideMimeType) {
          xhr.overrideMimeType("text/plain; charset=x-user-defined")
        }
        xhr.send(null);
        if (!(xhr.status >= 200 && xhr.status < 300 || xhr.status === 304)) throw new Error("Couldn't load " + url + ". Status: " + xhr.status);
        if (xhr.response !== undefined) {
          return new Uint8Array(xhr.response || [])
        } else {
          return intArrayFromString(xhr.responseText || "", true)
        }
      };
      var lazyArray = this;
      lazyArray.setDataGetter(function (chunkNum) {
        var start = chunkNum * chunkSize;
        var end = (chunkNum + 1) * chunkSize - 1;
        end = Math.min(end, datalength - 1);
        if (typeof lazyArray.chunks[chunkNum] === "undefined") {
          lazyArray.chunks[chunkNum] = doXHR(start, end)
        }
        if (typeof lazyArray.chunks[chunkNum] === "undefined") throw new Error("doXHR failed!");
        return lazyArray.chunks[chunkNum]
      });
      if (usesGzip || !datalength) {
        chunkSize = datalength = 1;
        datalength = this.getter(0).length;
        chunkSize = datalength;
        console.log("LazyFiles on gzip forces download of the whole file when length is accessed")
      }
      this._length = datalength;
      this._chunkSize = chunkSize;
      this.lengthKnown = true
    };
    if (typeof XMLHttpRequest !== "undefined") {
      if (!ENVIRONMENT_IS_WORKER) throw "Cannot do synchronous binary XHRs outside webworkers in modern browsers. Use --embed-file or --preload-file in emcc";
      var lazyArray = new LazyUint8Array;
      Object.defineProperties(lazyArray, {
        length: {
          get: function () {
            if (!this.lengthKnown) {
              this.cacheLength()
            }
            return this._length
          }
        },
        chunkSize: {
          get: function () {
            if (!this.lengthKnown) {
              this.cacheLength()
            }
            return this._chunkSize
          }
        }
      });
      var properties = {
        isDevice: false,
        contents: lazyArray
      }
    } else {
      var properties = {
        isDevice: false,
        url: url
      }
    }
    var node = FS.createFile(parent, name, properties, canRead, canWrite);
    if (properties.contents) {
      node.contents = properties.contents
    } else if (properties.url) {
      node.contents = null;
      node.url = properties.url
    }
    Object.defineProperties(node, {
      usedBytes: {
        get: function () {
          return this.contents.length
        }
      }
    });
    var stream_ops = {};
    var keys = Object.keys(node.stream_ops);
    keys.forEach(function (key) {
      var fn = node.stream_ops[key];
      stream_ops[key] = function forceLoadLazyFile() {
        if (!FS.forceLoadFile(node)) {
          throw new FS.ErrnoError(29)
        }
        return fn.apply(null, arguments)
      }
    });
    stream_ops.read = function stream_ops_read(stream, buffer, offset, length, position) {
      if (!FS.forceLoadFile(node)) {
        throw new FS.ErrnoError(29)
      }
      var contents = stream.node.contents;
      if (position >= contents.length) return 0;
      var size = Math.min(contents.length - position, length);
      if (contents.slice) {
        for (var i = 0; i < size; i++) {
          buffer[offset + i] = contents[position + i]
        }
      } else {
        for (var i = 0; i < size; i++) {
          buffer[offset + i] = contents.get(position + i)
        }
      }
      return size
    };
    node.stream_ops = stream_ops;
    return node
  },
  createPreloadedFile: function (parent, name, url, canRead, canWrite, onload, onerror, dontCreateFile, canOwn, preFinish) {
    Browser.init();
    var fullname = name ? PATH_FS.resolve(PATH.join2(parent, name)) : parent;
    var dep = getUniqueRunDependency("cp " + fullname);

    function processData(byteArray) {
      function finish(byteArray) {
        if (preFinish) preFinish();
        if (!dontCreateFile) {
          FS.createDataFile(parent, name, byteArray, canRead, canWrite, canOwn)
        }
        if (onload) onload();
        removeRunDependency(dep)
      }
      var handled = false;
      Module["preloadPlugins"].forEach(function (plugin) {
        if (handled) return;
        if (plugin["canHandle"](fullname)) {
          plugin["handle"](byteArray, fullname, finish, function () {
            if (onerror) onerror();
            removeRunDependency(dep)
          });
          handled = true
        }
      });
      if (!handled) finish(byteArray)
    }
    addRunDependency(dep);
    if (typeof url == "string") {
      Browser.asyncLoad(url, function (byteArray) {
        processData(byteArray)
      }, onerror)
    } else {
      processData(url)
    }
  },
  indexedDB: function () {
    return window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB
  },
  DB_NAME: function () {
    return "EM_FS_" + window.location.pathname
  },
  DB_VERSION: 20,
  DB_STORE_NAME: "FILE_DATA",
  saveFilesToDB: function (paths, onload, onerror) {
    onload = onload || function () { };
    onerror = onerror || function () { };
    var indexedDB = FS.indexedDB();
    try {
      var openRequest = indexedDB.open(FS.DB_NAME(), FS.DB_VERSION)
    } catch (e) {
      return onerror(e)
    }
    openRequest.onupgradeneeded = function openRequest_onupgradeneeded() {
      console.log("creating db");
      var db = openRequest.result;
      db.createObjectStore(FS.DB_STORE_NAME)
    };
    openRequest.onsuccess = function openRequest_onsuccess() {
      var db = openRequest.result;
      var transaction = db.transaction([FS.DB_STORE_NAME], "readwrite");
      var files = transaction.objectStore(FS.DB_STORE_NAME);
      var ok = 0,
        fail = 0,
        total = paths.length;

      function finish() {
        if (fail == 0) onload();
        else onerror()
      }
      paths.forEach(function (path) {
        var putRequest = files.put(FS.analyzePath(path).object.contents, path);
        putRequest.onsuccess = function putRequest_onsuccess() {
          ok++;
          if (ok + fail == total) finish()
        };
        putRequest.onerror = function putRequest_onerror() {
          fail++;
          if (ok + fail == total) finish()
        }
      });
      transaction.onerror = onerror
    };
    openRequest.onerror = onerror
  },
  loadFilesFromDB: function (paths, onload, onerror) {
    onload = onload || function () { };
    onerror = onerror || function () { };
    var indexedDB = FS.indexedDB();
    try {
      var openRequest = indexedDB.open(FS.DB_NAME(), FS.DB_VERSION)
    } catch (e) {
      return onerror(e)
    }
    openRequest.onupgradeneeded = onerror;
    openRequest.onsuccess = function openRequest_onsuccess() {
      var db = openRequest.result;
      try {
        var transaction = db.transaction([FS.DB_STORE_NAME], "readonly")
      } catch (e) {
        onerror(e);
        return
      }
      var files = transaction.objectStore(FS.DB_STORE_NAME);
      var ok = 0,
        fail = 0,
        total = paths.length;

      function finish() {
        if (fail == 0) onload();
        else onerror()
      }
      paths.forEach(function (path) {
        var getRequest = files.get(path);
        getRequest.onsuccess = function getRequest_onsuccess() {
          if (FS.analyzePath(path).exists) {
            FS.unlink(path)
          }
          FS.createDataFile(PATH.dirname(path), PATH.basename(path), getRequest.result, true, true, true);
          ok++;
          if (ok + fail == total) finish()
        };
        getRequest.onerror = function getRequest_onerror() {
          fail++;
          if (ok + fail == total) finish()
        }
      });
      transaction.onerror = onerror
    };
    openRequest.onerror = onerror
  }
};

function _SDL_GetTicks() {
  return Date.now() - SDL.startTime | 0
}

function _SDL_LockSurface(surf) {
  var surfData = SDL.surfaces[surf];
  surfData.locked++;
  if (surfData.locked > 1) return 0;
  if (!surfData.buffer) {
    surfData.buffer = _malloc(surfData.width * surfData.height * 4);
    HEAP32[surf + 20 >> 2] = surfData.buffer
  }
  HEAP32[surf + 20 >> 2] = surfData.buffer;
  if (surf == SDL.screen && Module.screenIsReadOnly && surfData.image) return 0;
  if (SDL.defaults.discardOnLock) {
    if (!surfData.image) {
      surfData.image = surfData.ctx.createImageData(surfData.width, surfData.height)
    }
    if (!SDL.defaults.opaqueFrontBuffer) return
  } else {
    surfData.image = surfData.ctx.getImageData(0, 0, surfData.width, surfData.height)
  }
  if (surf == SDL.screen && SDL.defaults.opaqueFrontBuffer) {
    var data = surfData.image.data;
    var num = data.length;
    for (var i = 0; i < num / 4; i++) {
      data[i * 4 + 3] = 255
    }
  }
  if (SDL.defaults.copyOnLock && !SDL.defaults.discardOnLock) {
    if (surfData.isFlagSet(2097152)) {
      throw "CopyOnLock is not supported for SDL_LockSurface with SDL_HWPALETTE flag set" + (new Error).stack
    } else {
      HEAPU8.set(surfData.image.data, surfData.buffer)
    }
  }
  return 0
}
var SDL = {
  defaults: {
    width: 320,
    height: 200,
    copyOnLock: false,
    discardOnLock: false,
    opaqueFrontBuffer: false
  },
  version: null,
  surfaces: {},
  canvasPool: [],
  events: [],
  fonts: [null],
  audios: [null],
  rwops: [null],
  music: {
    audio: null,
    volume: 1
  },
  mixerFrequency: 22050,
  mixerFormat: 32784,
  mixerNumChannels: 2,
  mixerChunkSize: 1024,
  channelMinimumNumber: 0,
  GL: false,
  glAttributes: {
    0: 3,
    1: 3,
    2: 2,
    3: 0,
    4: 0,
    5: 1,
    6: 16,
    7: 0,
    8: 0,
    9: 0,
    10: 0,
    11: 0,
    12: 0,
    13: 0,
    14: 0,
    15: 1,
    16: 0,
    17: 0,
    18: 0
  },
  keyboardState: null,
  keyboardMap: {},
  canRequestFullscreen: false,
  isRequestingFullscreen: false,
  textInput: false,
  startTime: null,
  initFlags: 0,
  buttonState: 0,
  modState: 0,
  DOMButtons: [0, 0, 0],
  DOMEventToSDLEvent: {},
  TOUCH_DEFAULT_ID: 0,
  eventHandler: null,
  eventHandlerContext: null,
  eventHandlerTemp: 0,
  keyCodes: {
    16: 1249,
    17: 1248,
    18: 1250,
    20: 1081,
    33: 1099,
    34: 1102,
    35: 1101,
    36: 1098,
    37: 1104,
    38: 1106,
    39: 1103,
    40: 1105,
    44: 316,
    45: 1097,
    46: 127,
    91: 1251,
    93: 1125,
    96: 1122,
    97: 1113,
    98: 1114,
    99: 1115,
    100: 1116,
    101: 1117,
    102: 1118,
    103: 1119,
    104: 1120,
    105: 1121,
    106: 1109,
    107: 1111,
    109: 1110,
    110: 1123,
    111: 1108,
    112: 1082,
    113: 1083,
    114: 1084,
    115: 1085,
    116: 1086,
    117: 1087,
    118: 1088,
    119: 1089,
    120: 1090,
    121: 1091,
    122: 1092,
    123: 1093,
    124: 1128,
    125: 1129,
    126: 1130,
    127: 1131,
    128: 1132,
    129: 1133,
    130: 1134,
    131: 1135,
    132: 1136,
    133: 1137,
    134: 1138,
    135: 1139,
    144: 1107,
    160: 94,
    161: 33,
    162: 34,
    163: 35,
    164: 36,
    165: 37,
    166: 38,
    167: 95,
    168: 40,
    169: 41,
    170: 42,
    171: 43,
    172: 124,
    173: 45,
    174: 123,
    175: 125,
    176: 126,
    181: 127,
    182: 129,
    183: 128,
    188: 44,
    190: 46,
    191: 47,
    192: 96,
    219: 91,
    220: 92,
    221: 93,
    222: 39,
    224: 1251
  },
  scanCodes: {
    8: 42,
    9: 43,
    13: 40,
    27: 41,
    32: 44,
    35: 204,
    39: 53,
    44: 54,
    46: 55,
    47: 56,
    48: 39,
    49: 30,
    50: 31,
    51: 32,
    52: 33,
    53: 34,
    54: 35,
    55: 36,
    56: 37,
    57: 38,
    58: 203,
    59: 51,
    61: 46,
    91: 47,
    92: 49,
    93: 48,
    96: 52,
    97: 4,
    98: 5,
    99: 6,
    100: 7,
    101: 8,
    102: 9,
    103: 10,
    104: 11,
    105: 12,
    106: 13,
    107: 14,
    108: 15,
    109: 16,
    110: 17,
    111: 18,
    112: 19,
    113: 20,
    114: 21,
    115: 22,
    116: 23,
    117: 24,
    118: 25,
    119: 26,
    120: 27,
    121: 28,
    122: 29,
    127: 76,
    305: 224,
    308: 226,
    316: 70
  },
  loadRect: function (rect) {
    return {
      x: HEAP32[rect + 0 >> 2],
      y: HEAP32[rect + 4 >> 2],
      w: HEAP32[rect + 8 >> 2],
      h: HEAP32[rect + 12 >> 2]
    }
  },
  updateRect: function (rect, r) {
    HEAP32[rect >> 2] = r.x;
    HEAP32[rect + 4 >> 2] = r.y;
    HEAP32[rect + 8 >> 2] = r.w;
    HEAP32[rect + 12 >> 2] = r.h
  },
  intersectionOfRects: function (first, second) {
    var leftX = Math.max(first.x, second.x);
    var leftY = Math.max(first.y, second.y);
    var rightX = Math.min(first.x + first.w, second.x + second.w);
    var rightY = Math.min(first.y + first.h, second.y + second.h);
    return {
      x: leftX,
      y: leftY,
      w: Math.max(leftX, rightX) - leftX,
      h: Math.max(leftY, rightY) - leftY
    }
  },
  checkPixelFormat: function (fmt) { },
  loadColorToCSSRGB: function (color) {
    var rgba = HEAP32[color >> 2];
    return "rgb(" + (rgba & 255) + "," + (rgba >> 8 & 255) + "," + (rgba >> 16 & 255) + ")"
  },
  loadColorToCSSRGBA: function (color) {
    var rgba = HEAP32[color >> 2];
    return "rgba(" + (rgba & 255) + "," + (rgba >> 8 & 255) + "," + (rgba >> 16 & 255) + "," + (rgba >> 24 & 255) / 255 + ")"
  },
  translateColorToCSSRGBA: function (rgba) {
    return "rgba(" + (rgba & 255) + "," + (rgba >> 8 & 255) + "," + (rgba >> 16 & 255) + "," + (rgba >>> 24) / 255 + ")"
  },
  translateRGBAToCSSRGBA: function (r, g, b, a) {
    return "rgba(" + (r & 255) + "," + (g & 255) + "," + (b & 255) + "," + (a & 255) / 255 + ")"
  },
  translateRGBAToColor: function (r, g, b, a) {
    return r | g << 8 | b << 16 | a << 24
  },
  makeSurface: function (width, height, flags, usePageCanvas, source, rmask, gmask, bmask, amask) {
    flags = flags || 0;
    var is_SDL_HWSURFACE = flags & 1;
    var is_SDL_HWPALETTE = flags & 2097152;
    var is_SDL_OPENGL = flags & 67108864;
    var surf = _malloc(60);
    var pixelFormat = _malloc(44);
    var bpp = is_SDL_HWPALETTE ? 1 : 4;
    var buffer = 0;
    if (!is_SDL_HWSURFACE && !is_SDL_OPENGL) {
      buffer = _malloc(width * height * 4)
    }
    HEAP32[surf >> 2] = flags;
    HEAP32[surf + 4 >> 2] = pixelFormat;
    HEAP32[surf + 8 >> 2] = width;
    HEAP32[surf + 12 >> 2] = height;
    HEAP32[surf + 16 >> 2] = width * bpp;
    HEAP32[surf + 20 >> 2] = buffer;
    HEAP32[surf + 36 >> 2] = 0;
    HEAP32[surf + 40 >> 2] = 0;
    HEAP32[surf + 44 >> 2] = Module["canvas"].width;
    HEAP32[surf + 48 >> 2] = Module["canvas"].height;
    HEAP32[surf + 56 >> 2] = 1;
    HEAP32[pixelFormat >> 2] = -2042224636;
    HEAP32[pixelFormat + 4 >> 2] = 0;
    HEAP8[pixelFormat + 8 >> 0] = bpp * 8;
    HEAP8[pixelFormat + 9 >> 0] = bpp;
    HEAP32[pixelFormat + 12 >> 2] = rmask || 255;
    HEAP32[pixelFormat + 16 >> 2] = gmask || 65280;
    HEAP32[pixelFormat + 20 >> 2] = bmask || 16711680;
    HEAP32[pixelFormat + 24 >> 2] = amask || 4278190080;
    SDL.GL = SDL.GL || is_SDL_OPENGL;
    var canvas;
    if (!usePageCanvas) {
      if (SDL.canvasPool.length > 0) {
        canvas = SDL.canvasPool.pop()
      } else {
        canvas = document.createElement("canvas")
      }
      canvas.width = width;
      canvas.height = height
    } else {
      canvas = Module["canvas"]
    }
    var webGLContextAttributes = {
      antialias: SDL.glAttributes[13] != 0 && SDL.glAttributes[14] > 1,
      depth: SDL.glAttributes[6] > 0,
      stencil: SDL.glAttributes[7] > 0,
      alpha: SDL.glAttributes[3] > 0
    };
    var ctx = Browser.createContext(canvas, is_SDL_OPENGL, usePageCanvas, webGLContextAttributes);
    SDL.surfaces[surf] = {
      width: width,
      height: height,
      canvas: canvas,
      ctx: ctx,
      surf: surf,
      buffer: buffer,
      pixelFormat: pixelFormat,
      alpha: 255,
      flags: flags,
      locked: 0,
      usePageCanvas: usePageCanvas,
      source: source,
      isFlagSet: function (flag) {
        return flags & flag
      }
    };
    return surf
  },
  copyIndexedColorData: function (surfData, rX, rY, rW, rH) {
    if (!surfData.colors) {
      return
    }
    var fullWidth = Module["canvas"].width;
    var fullHeight = Module["canvas"].height;
    var startX = rX || 0;
    var startY = rY || 0;
    var endX = (rW || fullWidth - startX) + startX;
    var endY = (rH || fullHeight - startY) + startY;
    var buffer = surfData.buffer;
    if (!surfData.image.data32) {
      surfData.image.data32 = new Uint32Array(surfData.image.data.buffer)
    }
    var data32 = surfData.image.data32;
    var colors32 = surfData.colors32;
    for (var y = startY; y < endY; ++y) {
      var base = y * fullWidth;
      for (var x = startX; x < endX; ++x) {
        data32[base + x] = colors32[HEAPU8[buffer + base + x >> 0]]
      }
    }
  },
  freeSurface: function (surf) {
    var refcountPointer = surf + 56;
    var refcount = HEAP32[refcountPointer >> 2];
    if (refcount > 1) {
      HEAP32[refcountPointer >> 2] = refcount - 1;
      return
    }
    var info = SDL.surfaces[surf];
    if (!info.usePageCanvas && info.canvas) SDL.canvasPool.push(info.canvas);
    if (info.buffer) _free(info.buffer);
    _free(info.pixelFormat);
    _free(surf);
    SDL.surfaces[surf] = null;
    if (surf === SDL.screen) {
      SDL.screen = null
    }
  },
  blitSurface: function (src, srcrect, dst, dstrect, scale) {
    var srcData = SDL.surfaces[src];
    var dstData = SDL.surfaces[dst];
    var sr, dr;
    if (srcrect) {
      sr = SDL.loadRect(srcrect)
    } else {
      sr = {
        x: 0,
        y: 0,
        w: srcData.width,
        h: srcData.height
      }
    }
    if (dstrect) {
      dr = SDL.loadRect(dstrect)
    } else {
      dr = {
        x: 0,
        y: 0,
        w: srcData.width,
        h: srcData.height
      }
    }
    if (dstData.clipRect) {
      var widthScale = !scale || sr.w === 0 ? 1 : sr.w / dr.w;
      var heightScale = !scale || sr.h === 0 ? 1 : sr.h / dr.h;
      dr = SDL.intersectionOfRects(dstData.clipRect, dr);
      sr.w = dr.w * widthScale;
      sr.h = dr.h * heightScale;
      if (dstrect) {
        SDL.updateRect(dstrect, dr)
      }
    }
    var blitw, blith;
    if (scale) {
      blitw = dr.w;
      blith = dr.h
    } else {
      blitw = sr.w;
      blith = sr.h
    }
    if (sr.w === 0 || sr.h === 0 || blitw === 0 || blith === 0) {
      return 0
    }
    var oldAlpha = dstData.ctx.globalAlpha;
    dstData.ctx.globalAlpha = srcData.alpha / 255;
    dstData.ctx.drawImage(srcData.canvas, sr.x, sr.y, sr.w, sr.h, dr.x, dr.y, blitw, blith);
    dstData.ctx.globalAlpha = oldAlpha;
    if (dst != SDL.screen) {
      warnOnce("WARNING: copying canvas data to memory for compatibility");
      _SDL_LockSurface(dst);
      dstData.locked--
    }
    return 0
  },
  downFingers: {},
  savedKeydown: null,
  receiveEvent: function (event) {
    function unpressAllPressedKeys() {
      for (var code in SDL.keyboardMap) {
        SDL.events.push({
          type: "keyup",
          keyCode: SDL.keyboardMap[code]
        })
      }
    }
    switch (event.type) {
      case "touchstart":
      case "touchmove": {
        event.preventDefault();
        var touches = [];
        if (event.type === "touchstart") {
          for (var i = 0; i < event.touches.length; i++) {
            var touch = event.touches[i];
            if (SDL.downFingers[touch.identifier] != true) {
              SDL.downFingers[touch.identifier] = true;
              touches.push(touch)
            }
          }
        } else {
          touches = event.touches
        }
        var firstTouch = touches[0];
        if (firstTouch) {
          if (event.type == "touchstart") {
            SDL.DOMButtons[0] = 1
          }
          var mouseEventType;
          switch (event.type) {
            case "touchstart":
              mouseEventType = "mousedown";
              break;
            case "touchmove":
              mouseEventType = "mousemove";
              break
          }
          var mouseEvent = {
            type: mouseEventType,
            button: 0,
            pageX: firstTouch.clientX,
            pageY: firstTouch.clientY
          };
          SDL.events.push(mouseEvent)
        }
        for (var i = 0; i < touches.length; i++) {
          var touch = touches[i];
          SDL.events.push({
            type: event.type,
            touch: touch
          })
        }
        break
      }
      case "touchend": {
        event.preventDefault();
        for (var i = 0; i < event.changedTouches.length; i++) {
          var touch = event.changedTouches[i];
          if (SDL.downFingers[touch.identifier] === true) {
            delete SDL.downFingers[touch.identifier]
          }
        }
        var mouseEvent = {
          type: "mouseup",
          button: 0,
          pageX: event.changedTouches[0].clientX,
          pageY: event.changedTouches[0].clientY
        };
        SDL.DOMButtons[0] = 0;
        SDL.events.push(mouseEvent);
        for (var i = 0; i < event.changedTouches.length; i++) {
          var touch = event.changedTouches[i];
          SDL.events.push({
            type: "touchend",
            touch: touch
          })
        }
        break
      }
      case "DOMMouseScroll":
      case "mousewheel":
      case "wheel":
        var delta = -Browser.getMouseWheelDelta(event);
        delta = delta == 0 ? 0 : delta > 0 ? Math.max(delta, 1) : Math.min(delta, -1);
        var button = delta > 0 ? 3 : 4;
        SDL.events.push({
          type: "mousedown",
          button: button,
          pageX: event.pageX,
          pageY: event.pageY
        });
        SDL.events.push({
          type: "mouseup",
          button: button,
          pageX: event.pageX,
          pageY: event.pageY
        });
        SDL.events.push({
          type: "wheel",
          deltaX: 0,
          deltaY: delta
        });
        event.preventDefault();
        break;
      case "mousemove":
        if (SDL.DOMButtons[0] === 1) {
          SDL.events.push({
            type: "touchmove",
            touch: {
              identifier: 0,
              deviceID: -1,
              pageX: event.pageX,
              pageY: event.pageY
            }
          })
        }
        if (Browser.pointerLock) {
          if ("mozMovementX" in event) {
            event["movementX"] = event["mozMovementX"];
            event["movementY"] = event["mozMovementY"]
          }
          if (event["movementX"] == 0 && event["movementY"] == 0) {
            event.preventDefault();
            return
          }
        }
      case "keydown":
      case "keyup":
      case "keypress":
      case "mousedown":
      case "mouseup":
        if (event.type !== "keydown" || !SDL.unicode && !SDL.textInput || (event.keyCode === 8 || event.keyCode === 9)) {
          event.preventDefault()
        }
        if (event.type == "mousedown") {
          SDL.DOMButtons[event.button] = 1;
          SDL.events.push({
            type: "touchstart",
            touch: {
              identifier: 0,
              deviceID: -1,
              pageX: event.pageX,
              pageY: event.pageY
            }
          })
        } else if (event.type == "mouseup") {
          if (!SDL.DOMButtons[event.button]) {
            return
          }
          SDL.events.push({
            type: "touchend",
            touch: {
              identifier: 0,
              deviceID: -1,
              pageX: event.pageX,
              pageY: event.pageY
            }
          });
          SDL.DOMButtons[event.button] = 0
        }
        if (event.type === "keydown" || event.type === "mousedown") {
          SDL.canRequestFullscreen = true
        } else if (event.type === "keyup" || event.type === "mouseup") {
          if (SDL.isRequestingFullscreen) {
            Module["requestFullscreen"](true, true);
            SDL.isRequestingFullscreen = false
          }
          SDL.canRequestFullscreen = false
        }
        if (event.type === "keypress" && SDL.savedKeydown) {
          SDL.savedKeydown.keypressCharCode = event.charCode;
          SDL.savedKeydown = null
        } else if (event.type === "keydown") {
          SDL.savedKeydown = event
        }
        if (event.type !== "keypress" || SDL.textInput) {
          SDL.events.push(event)
        }
        break;
      case "mouseout":
        for (var i = 0; i < 3; i++) {
          if (SDL.DOMButtons[i]) {
            SDL.events.push({
              type: "mouseup",
              button: i,
              pageX: event.pageX,
              pageY: event.pageY
            });
            SDL.DOMButtons[i] = 0
          }
        }
        event.preventDefault();
        break;
      case "focus":
        SDL.events.push(event);
        event.preventDefault();
        break;
      case "blur":
        SDL.events.push(event);
        unpressAllPressedKeys();
        event.preventDefault();
        break;
      case "visibilitychange":
        SDL.events.push({
          type: "visibilitychange",
          visible: !document.hidden
        });
        unpressAllPressedKeys();
        event.preventDefault();
        break;
      case "unload":
        if (Browser.mainLoop.runner) {
          SDL.events.push(event);
          Browser.mainLoop.runner()
        }
        return;
      case "resize":
        SDL.events.push(event);
        if (event.preventDefault) {
          event.preventDefault()
        }
        break
    }
    if (SDL.events.length >= 1e4) {
      err("SDL event queue full, dropping events");
      SDL.events = SDL.events.slice(0, 1e4)
    }
    SDL.flushEventsToHandler();
    return
  },
  lookupKeyCodeForEvent: function (event) {
    var code = event.keyCode;
    if (code >= 65 && code <= 90) {
      code += 32
    } else {
      code = SDL.keyCodes[event.keyCode] || event.keyCode;
      if (event.location === KeyboardEvent.DOM_KEY_LOCATION_RIGHT && code >= (224 | 1 << 10) && code <= (227 | 1 << 10)) {
        code += 4
      }
    }
    return code
  },
  handleEvent: function (event) {
    if (event.handled) return;
    event.handled = true;
    switch (event.type) {
      case "touchstart":
      case "touchend":
      case "touchmove": {
        Browser.calculateMouseEvent(event);
        break
      }
      case "keydown":
      case "keyup": {
        var down = event.type === "keydown";
        var code = SDL.lookupKeyCodeForEvent(event);
        HEAP8[SDL.keyboardState + code >> 0] = down;
        SDL.modState = (HEAP8[SDL.keyboardState + 1248 >> 0] ? 64 : 0) | (HEAP8[SDL.keyboardState + 1249 >> 0] ? 1 : 0) | (HEAP8[SDL.keyboardState + 1250 >> 0] ? 256 : 0) | (HEAP8[SDL.keyboardState + 1252 >> 0] ? 128 : 0) | (HEAP8[SDL.keyboardState + 1253 >> 0] ? 2 : 0) | (HEAP8[SDL.keyboardState + 1254 >> 0] ? 512 : 0);
        if (down) {
          SDL.keyboardMap[code] = event.keyCode
        } else {
          delete SDL.keyboardMap[code]
        }
        break
      }
      case "mousedown":
      case "mouseup":
        if (event.type == "mousedown") {
          SDL.buttonState |= 1 << event.button
        } else if (event.type == "mouseup") {
          SDL.buttonState &= ~(1 << event.button)
        }
      case "mousemove": {
        Browser.calculateMouseEvent(event);
        break
      }
    }
  },
  flushEventsToHandler: function () {
    if (!SDL.eventHandler) return;
    while (SDL.pollEvent(SDL.eventHandlerTemp)) {
      Module["dynCall_iii"](SDL.eventHandler, SDL.eventHandlerContext, SDL.eventHandlerTemp)
    }
  },
  pollEvent: function (ptr) {
    if (SDL.initFlags & 512 && SDL.joystickEventState) {
      SDL.queryJoysticks()
    }
    if (ptr) {
      while (SDL.events.length > 0) {
        if (SDL.makeCEvent(SDL.events.shift(), ptr) !== false) return 1
      }
      return 0
    } else {
      return SDL.events.length > 0
    }
  },
  makeCEvent: function (event, ptr) {
    if (typeof event === "number") {
      _memcpy(ptr, event, 28);
      _free(event);
      return
    }
    SDL.handleEvent(event);
    switch (event.type) {
      case "keydown":
      case "keyup": {
        var down = event.type === "keydown";
        var key = SDL.lookupKeyCodeForEvent(event);
        var scan;
        if (key >= 1024) {
          scan = key - 1024
        } else {
          scan = SDL.scanCodes[key] || key
        }
        HEAP32[ptr >> 2] = SDL.DOMEventToSDLEvent[event.type];
        HEAP8[ptr + 8 >> 0] = down ? 1 : 0;
        HEAP8[ptr + 9 >> 0] = 0;
        HEAP32[ptr + 12 >> 2] = scan;
        HEAP32[ptr + 16 >> 2] = key;
        HEAP16[ptr + 20 >> 1] = SDL.modState;
        HEAP32[ptr + 24 >> 2] = event.keypressCharCode || key;
        break
      }
      case "keypress": {
        HEAP32[ptr >> 2] = SDL.DOMEventToSDLEvent[event.type];
        var cStr = intArrayFromString(String.fromCharCode(event.charCode));
        for (var i = 0; i < cStr.length; ++i) {
          HEAP8[ptr + (8 + i) >> 0] = cStr[i]
        }
        break
      }
      case "mousedown":
      case "mouseup":
      case "mousemove": {
        if (event.type != "mousemove") {
          var down = event.type === "mousedown";
          HEAP32[ptr >> 2] = SDL.DOMEventToSDLEvent[event.type];
          HEAP32[ptr + 4 >> 2] = 0;
          HEAP32[ptr + 8 >> 2] = 0;
          HEAP32[ptr + 12 >> 2] = 0;
          HEAP8[ptr + 16 >> 0] = event.button + 1;
          HEAP8[ptr + 17 >> 0] = down ? 1 : 0;
          HEAP32[ptr + 20 >> 2] = Browser.mouseX;
          HEAP32[ptr + 24 >> 2] = Browser.mouseY
        } else {
          HEAP32[ptr >> 2] = SDL.DOMEventToSDLEvent[event.type];
          HEAP32[ptr + 4 >> 2] = 0;
          HEAP32[ptr + 8 >> 2] = 0;
          HEAP32[ptr + 12 >> 2] = 0;
          HEAP32[ptr + 16 >> 2] = SDL.buttonState;
          HEAP32[ptr + 20 >> 2] = Browser.mouseX;
          HEAP32[ptr + 24 >> 2] = Browser.mouseY;
          HEAP32[ptr + 28 >> 2] = Browser.mouseMovementX;
          HEAP32[ptr + 32 >> 2] = Browser.mouseMovementY
        }
        break
      }
      case "wheel": {
        HEAP32[ptr >> 2] = SDL.DOMEventToSDLEvent[event.type];
        HEAP32[ptr + 16 >> 2] = event.deltaX;
        HEAP32[ptr + 20 >> 2] = event.deltaY;
        break
      }
      case "touchstart":
      case "touchend":
      case "touchmove": {
        var touch = event.touch;
        if (!Browser.touches[touch.identifier]) break;
        var w = Module["canvas"].width;
        var h = Module["canvas"].height;
        var x = Browser.touches[touch.identifier].x / w;
        var y = Browser.touches[touch.identifier].y / h;
        var lx = Browser.lastTouches[touch.identifier].x / w;
        var ly = Browser.lastTouches[touch.identifier].y / h;
        var dx = x - lx;
        var dy = y - ly;
        if (touch["deviceID"] === undefined) touch.deviceID = SDL.TOUCH_DEFAULT_ID;
        if (dx === 0 && dy === 0 && event.type === "touchmove") return false;
        HEAP32[ptr >> 2] = SDL.DOMEventToSDLEvent[event.type];
        HEAP32[ptr + 4 >> 2] = _SDL_GetTicks();
        tempI64 = [touch.deviceID >>> 0, (tempDouble = touch.deviceID, +Math_abs(tempDouble) >= +1 ? tempDouble > +0 ? (Math_min(+Math_floor(tempDouble / +4294967296), +4294967295) | 0) >>> 0 : ~~+Math_ceil((tempDouble - +(~~tempDouble >>> 0)) / +4294967296) >>> 0 : 0)], HEAP32[ptr + 8 >> 2] = tempI64[0], HEAP32[ptr + 12 >> 2] = tempI64[1];
        tempI64 = [touch.identifier >>> 0, (tempDouble = touch.identifier, +Math_abs(tempDouble) >= +1 ? tempDouble > +0 ? (Math_min(+Math_floor(tempDouble / +4294967296), +4294967295) | 0) >>> 0 : ~~+Math_ceil((tempDouble - +(~~tempDouble >>> 0)) / +4294967296) >>> 0 : 0)], HEAP32[ptr + 16 >> 2] = tempI64[0], HEAP32[ptr + 20 >> 2] = tempI64[1];
        HEAPF32[ptr + 24 >> 2] = x;
        HEAPF32[ptr + 28 >> 2] = y;
        HEAPF32[ptr + 32 >> 2] = dx;
        HEAPF32[ptr + 36 >> 2] = dy;
        if (touch.force !== undefined) {
          HEAPF32[ptr + 40 >> 2] = touch.force
        } else {
          HEAPF32[ptr + 40 >> 2] = event.type == "touchend" ? 0 : 1
        }
        break
      }
      case "unload": {
        HEAP32[ptr >> 2] = SDL.DOMEventToSDLEvent[event.type];
        break
      }
      case "resize": {
        HEAP32[ptr >> 2] = SDL.DOMEventToSDLEvent[event.type];
        HEAP32[ptr + 4 >> 2] = event.w;
        HEAP32[ptr + 8 >> 2] = event.h;
        break
      }
      case "joystick_button_up":
      case "joystick_button_down": {
        var state = event.type === "joystick_button_up" ? 0 : 1;
        HEAP32[ptr >> 2] = SDL.DOMEventToSDLEvent[event.type];
        HEAP8[ptr + 4 >> 0] = event.index;
        HEAP8[ptr + 5 >> 0] = event.button;
        HEAP8[ptr + 6 >> 0] = state;
        break
      }
      case "joystick_axis_motion": {
        HEAP32[ptr >> 2] = SDL.DOMEventToSDLEvent[event.type];
        HEAP8[ptr + 4 >> 0] = event.index;
        HEAP8[ptr + 5 >> 0] = event.axis;
        HEAP32[ptr + 8 >> 2] = SDL.joystickAxisValueConversion(event.value);
        break
      }
      case "focus": {
        var SDL_WINDOWEVENT_FOCUS_GAINED = 12;
        HEAP32[ptr >> 2] = SDL.DOMEventToSDLEvent[event.type];
        HEAP32[ptr + 4 >> 2] = 0;
        HEAP8[ptr + 8 >> 0] = SDL_WINDOWEVENT_FOCUS_GAINED;
        break
      }
      case "blur": {
        var SDL_WINDOWEVENT_FOCUS_LOST = 13;
        HEAP32[ptr >> 2] = SDL.DOMEventToSDLEvent[event.type];
        HEAP32[ptr + 4 >> 2] = 0;
        HEAP8[ptr + 8 >> 0] = SDL_WINDOWEVENT_FOCUS_LOST;
        break
      }
      case "visibilitychange": {
        var SDL_WINDOWEVENT_SHOWN = 1;
        var SDL_WINDOWEVENT_HIDDEN = 2;
        var visibilityEventID = event.visible ? SDL_WINDOWEVENT_SHOWN : SDL_WINDOWEVENT_HIDDEN;
        HEAP32[ptr >> 2] = SDL.DOMEventToSDLEvent[event.type];
        HEAP32[ptr + 4 >> 2] = 0;
        HEAP8[ptr + 8 >> 0] = visibilityEventID;
        break
      }
      default:
        throw "Unhandled SDL event: " + event.type
    }
  },
  makeFontString: function (height, fontName) {
    if (fontName.charAt(0) != "'" && fontName.charAt(0) != '"') {
      fontName = '"' + fontName + '"'
    }
    return height + "px " + fontName + ", serif"
  },
  estimateTextWidth: function (fontData, text) {
    var h = fontData.size;
    var fontString = SDL.makeFontString(h, fontData.name);
    var tempCtx = SDL.ttfContext;
    tempCtx.font = fontString;
    var ret = tempCtx.measureText(text).width | 0;
    return ret
  },
  allocateChannels: function (num) {
    if (SDL.numChannels && SDL.numChannels >= num && num != 0) return;
    SDL.numChannels = num;
    SDL.channels = [];
    for (var i = 0; i < num; i++) {
      SDL.channels[i] = {
        audio: null,
        volume: 1
      }
    }
  },
  setGetVolume: function (info, volume) {
    if (!info) return 0;
    var ret = info.volume * 128;
    if (volume != -1) {
      info.volume = Math.min(Math.max(volume, 0), 128) / 128;
      if (info.audio) {
        try {
          info.audio.volume = info.volume;
          if (info.audio.webAudioGainNode) info.audio.webAudioGainNode["gain"]["value"] = info.volume
        } catch (e) {
          err("setGetVolume failed to set audio volume: " + e)
        }
      }
    }
    return ret
  },
  setPannerPosition: function (info, x, y, z) {
    if (!info) return;
    if (info.audio) {
      if (info.audio.webAudioPannerNode) {
        info.audio.webAudioPannerNode["setPosition"](x, y, z)
      }
    }
  },
  playWebAudio: function (audio) {
    if (!audio) return;
    if (audio.webAudioNode) return;
    if (!SDL.webAudioAvailable()) return;
    try {
      var webAudio = audio.resource.webAudio;
      audio.paused = false;
      if (!webAudio.decodedBuffer) {
        if (webAudio.onDecodeComplete === undefined) abort("Cannot play back audio object that was not loaded");
        webAudio.onDecodeComplete.push(function () {
          if (!audio.paused) SDL.playWebAudio(audio)
        });
        return
      }
      audio.webAudioNode = SDL.audioContext["createBufferSource"]();
      audio.webAudioNode["buffer"] = webAudio.decodedBuffer;
      audio.webAudioNode["loop"] = audio.loop;
      audio.webAudioNode["onended"] = function () {
        audio["onended"]()
      };
      audio.webAudioPannerNode = SDL.audioContext["createPanner"]();
      audio.webAudioPannerNode["setPosition"](0, 0, -.5);
      audio.webAudioPannerNode["panningModel"] = "equalpower";
      audio.webAudioGainNode = SDL.audioContext["createGain"]();
      audio.webAudioGainNode["gain"]["value"] = audio.volume;
      audio.webAudioNode["connect"](audio.webAudioPannerNode);
      audio.webAudioPannerNode["connect"](audio.webAudioGainNode);
      audio.webAudioGainNode["connect"](SDL.audioContext["destination"]);
      audio.webAudioNode["start"](0, audio.currentPosition);
      audio.startTime = SDL.audioContext["currentTime"] - audio.currentPosition
    } catch (e) {
      err("playWebAudio failed: " + e)
    }
  },
  pauseWebAudio: function (audio) {
    if (!audio) return;
    if (audio.webAudioNode) {
      try {
        audio.currentPosition = (SDL.audioContext["currentTime"] - audio.startTime) % audio.resource.webAudio.decodedBuffer.duration;
        audio.webAudioNode["onended"] = undefined;
        audio.webAudioNode.stop(0);
        audio.webAudioNode = undefined
      } catch (e) {
        err("pauseWebAudio failed: " + e)
      }
    }
    audio.paused = true
  },
  openAudioContext: function () {
    if (!SDL.audioContext) {
      if (typeof AudioContext !== "undefined") SDL.audioContext = new AudioContext;
      else if (typeof webkitAudioContext !== "undefined") SDL.audioContext = new webkitAudioContext
    }
  },
  webAudioAvailable: function () {
    return !!SDL.audioContext
  },
  fillWebAudioBufferFromHeap: function (heapPtr, sizeSamplesPerChannel, dstAudioBuffer) {
    var numChannels = SDL.audio.channels;
    for (var c = 0; c < numChannels; ++c) {
      var channelData = dstAudioBuffer["getChannelData"](c);
      if (channelData.length != sizeSamplesPerChannel) {
        throw "Web Audio output buffer length mismatch! Destination size: " + channelData.length + " samples vs expected " + sizeSamplesPerChannel + " samples!"
      }
      if (SDL.audio.format == 32784) {
        for (var j = 0; j < sizeSamplesPerChannel; ++j) {
          channelData[j] = HEAP16[heapPtr + (j * numChannels + c) * 2 >> 1] / 32768
        }
      } else if (SDL.audio.format == 8) {
        for (var j = 0; j < sizeSamplesPerChannel; ++j) {
          var v = HEAP8[heapPtr + (j * numChannels + c) >> 0];
          channelData[j] = (v >= 0 ? v - 128 : v + 128) / 128
        }
      } else if (SDL.audio.format == 33056) {
        for (var j = 0; j < sizeSamplesPerChannel; ++j) {
          channelData[j] = HEAPF32[heapPtr + (j * numChannels + c) * 4 >> 2]
        }
      } else {
        throw "Invalid SDL audio format " + SDL.audio.format + "!"
      }
    }
  },
  debugSurface: function (surfData) {
    console.log("dumping surface " + [surfData.surf, surfData.source, surfData.width, surfData.height]);
    var image = surfData.ctx.getImageData(0, 0, surfData.width, surfData.height);
    var data = image.data;
    var num = Math.min(surfData.width, surfData.height);
    for (var i = 0; i < num; i++) {
      console.log("   diagonal " + i + ":" + [data[i * surfData.width * 4 + i * 4 + 0], data[i * surfData.width * 4 + i * 4 + 1], data[i * surfData.width * 4 + i * 4 + 2], data[i * surfData.width * 4 + i * 4 + 3]])
    }
  },
  joystickEventState: 1,
  lastJoystickState: {},
  joystickNamePool: {},
  recordJoystickState: function (joystick, state) {
    var buttons = new Array(state.buttons.length);
    for (var i = 0; i < state.buttons.length; i++) {
      buttons[i] = SDL.getJoystickButtonState(state.buttons[i])
    }
    SDL.lastJoystickState[joystick] = {
      buttons: buttons,
      axes: state.axes.slice(0),
      timestamp: state.timestamp,
      index: state.index,
      id: state.id
    }
  },
  getJoystickButtonState: function (button) {
    if (typeof button === "object") {
      return button["pressed"]
    } else {
      return button > 0
    }
  },
  queryJoysticks: function () {
    for (var joystick in SDL.lastJoystickState) {
      var state = SDL.getGamepad(joystick - 1);
      var prevState = SDL.lastJoystickState[joystick];
      if (typeof state === "undefined") return;
      if (state === null) return;
      if (typeof state.timestamp !== "number" || state.timestamp !== prevState.timestamp || !state.timestamp) {
        var i;
        for (i = 0; i < state.buttons.length; i++) {
          var buttonState = SDL.getJoystickButtonState(state.buttons[i]);
          if (buttonState !== prevState.buttons[i]) {
            SDL.events.push({
              type: buttonState ? "joystick_button_down" : "joystick_button_up",
              joystick: joystick,
              index: joystick - 1,
              button: i
            })
          }
        }
        for (i = 0; i < state.axes.length; i++) {
          if (state.axes[i] !== prevState.axes[i]) {
            SDL.events.push({
              type: "joystick_axis_motion",
              joystick: joystick,
              index: joystick - 1,
              axis: i,
              value: state.axes[i]
            })
          }
        }
        SDL.recordJoystickState(joystick, state)
      }
    }
  },
  joystickAxisValueConversion: function (value) {
    value = Math.min(1, Math.max(value, -1));
    return Math.ceil((value + 1) * 32767.5 - 32768)
  },
  getGamepads: function () {
    var fcn = navigator.getGamepads || navigator.webkitGamepads || navigator.mozGamepads || navigator.gamepads || navigator.webkitGetGamepads;
    if (fcn !== undefined) {
      return fcn.apply(navigator)
    } else {
      return []
    }
  },
  getGamepad: function (deviceIndex) {
    var gamepads = SDL.getGamepads();
    if (gamepads.length > deviceIndex && deviceIndex >= 0) {
      return gamepads[deviceIndex]
    }
    return null
  }
};

function _SDL_PauseAudio(pauseOn) {
  if (!SDL.audio) {
    return
  }
  if (pauseOn) {
    if (SDL.audio.timer !== undefined) {
      clearTimeout(SDL.audio.timer);
      SDL.audio.numAudioTimersPending = 0;
      SDL.audio.timer = undefined
    }
  } else if (!SDL.audio.timer) {
    SDL.audio.numAudioTimersPending = 1;
    SDL.audio.timer = Browser.safeSetTimeout(SDL.audio.caller, 1)
  }
  SDL.audio.paused = pauseOn
}

function _SDL_CloseAudio() {
  if (SDL.audio) {
    EmterpreterAsync.yieldCallbacks = EmterpreterAsync.yieldCallbacks.filter(function (callback) {
      return callback !== SDL.audio.yieldCallback
    });
    _SDL_PauseAudio(1);
    _free(SDL.audio.buffer);
    SDL.audio = null;
    SDL.allocateChannels(0)
  }
}

function _SDL_CreateRGBSurface(flags, width, height, depth, rmask, gmask, bmask, amask) {
  return SDL.makeSurface(width, height, flags, false, "CreateRGBSurface", rmask, gmask, bmask, amask)
}
var EmterpreterAsync = {
  initted: false,
  state: 0,
  saveStack: "",
  yieldCallbacks: [],
  postAsync: null,
  restartFunc: null,
  asyncFinalizers: [],
  ensureInit: function () {
    if (this.initted) return;
    this.initted = true
  },
  setState: function (s) {
    this.ensureInit();
    this.state = s;
    Module["setAsyncState"](s)
  },
  handle: function (doAsyncOp, yieldDuring) {
    noExitRuntime = true;
    if (EmterpreterAsync.state === 0) {
      var stack = new Int32Array(HEAP32.subarray(EMTSTACKTOP >> 2, Module["emtStackSave"]() >> 2));
      var resumedCallbacksForYield = false;

      function resumeCallbacksForYield() {
        if (resumedCallbacksForYield) return;
        resumedCallbacksForYield = true;
        EmterpreterAsync.yieldCallbacks.forEach(function (func) {
          func()
        });
        Browser.resumeAsyncCallbacks()
      }
      var callingDoAsyncOp = 1;
      doAsyncOp(function resume(post) {
        if (ABORT) {
          return
        }
        if (callingDoAsyncOp) {
          assert(callingDoAsyncOp === 1);
          callingDoAsyncOp++;
          setTimeout(function () {
            resume(post)
          }, 0);
          return
        }
        assert(EmterpreterAsync.state === 1 || EmterpreterAsync.state === 3);
        EmterpreterAsync.setState(3);
        if (yieldDuring) {
          resumeCallbacksForYield()
        }
        HEAP32.set(stack, EMTSTACKTOP >> 2);
        EmterpreterAsync.setState(2);
        if (Browser.mainLoop.func) {
          Browser.mainLoop.resume()
        }
        assert(!EmterpreterAsync.postAsync);
        EmterpreterAsync.postAsync = post || null;
        var asyncReturnValue;
        if (!EmterpreterAsync.restartFunc) {
          Module["emterpret"](stack[0])
        } else {
          asyncReturnValue = EmterpreterAsync.restartFunc()
        }
        if (!yieldDuring && EmterpreterAsync.state === 0) {
          Browser.resumeAsyncCallbacks()
        }
        if (EmterpreterAsync.state === 0) {
          EmterpreterAsync.restartFunc = null;
          var asyncFinalizers = EmterpreterAsync.asyncFinalizers;
          EmterpreterAsync.asyncFinalizers = [];
          asyncFinalizers.forEach(function (func) {
            func(asyncReturnValue)
          })
        }
      });
      callingDoAsyncOp = 0;
      EmterpreterAsync.setState(1);
      if (Browser.mainLoop.func) {
        Browser.mainLoop.pause()
      }
      if (yieldDuring) {
        setTimeout(function () {
          resumeCallbacksForYield()
        }, 0)
      } else {
        Browser.pauseAsyncCallbacks()
      }
    } else {
      assert(EmterpreterAsync.state === 2);
      EmterpreterAsync.setState(0);
      if (EmterpreterAsync.postAsync) {
        var ret = EmterpreterAsync.postAsync();
        EmterpreterAsync.postAsync = null;
        return ret
      }
    }
  }
};

function _emscripten_sleep(ms) {
  EmterpreterAsync.handle(function (resume) {
    setTimeout(function () {
      resume()
    }, ms)
  })
}

function _SDL_Delay(delay) {
  _emscripten_sleep(delay)
}

function _SDL_FillRect(surf, rect, color) {
  var surfData = SDL.surfaces[surf];
  assert(!surfData.locked);
  if (surfData.isFlagSet(2097152)) {
    color = surfData.colors32[color]
  }
  var r = rect ? SDL.loadRect(rect) : {
    x: 0,
    y: 0,
    w: surfData.width,
    h: surfData.height
  };
  if (surfData.clipRect) {
    r = SDL.intersectionOfRects(surfData.clipRect, r);
    if (rect) {
      SDL.updateRect(rect, r)
    }
  }

  return 0
}

function _SDL_Flip(surf) { }

function _SDL_FreeSurface(surf) {
  if (surf) SDL.freeSurface(surf)
}

function _SDL_GetError() {
  if (!SDL.errorMessage) {
    SDL.errorMessage = allocate(intArrayFromString("unknown SDL-emscripten error"), "i8", ALLOC_NORMAL)
  }
  return SDL.errorMessage
}

function _SDL_GetKeyName(key) {
  if (!SDL.keyName) {
    SDL.keyName = allocate(intArrayFromString("unknown key"), "i8", ALLOC_NORMAL)
  }
  return SDL.keyName
}

function _SDL_GetModState() {
  return SDL.modState
}

function _SDL_GetVideoInfo() {
  var ret = _malloc(5 * 4);
  HEAP32[ret + 0 >> 2] = 0;
  HEAP32[ret + 4 >> 2] = 0;
  HEAP32[ret + 8 >> 2] = 0;
  HEAP32[ret + 12 >> 2] = Module["canvas"].width;
  HEAP32[ret + 16 >> 2] = Module["canvas"].height;
  return ret
}

function _SDL_Init(initFlags) {
  SDL.startTime = Date.now();
  SDL.initFlags = initFlags;
  if (!Module["doNotCaptureKeyboard"]) {
    var keyboardListeningElement = Module["keyboardListeningElement"] || document;
    keyboardListeningElement.addEventListener("keydown", SDL.receiveEvent);
    keyboardListeningElement.addEventListener("keyup", SDL.receiveEvent);
    keyboardListeningElement.addEventListener("keypress", SDL.receiveEvent);
    window.addEventListener("focus", SDL.receiveEvent);
    window.addEventListener("blur", SDL.receiveEvent);
    document.addEventListener("visibilitychange", SDL.receiveEvent)
  }
  window.addEventListener("unload", SDL.receiveEvent);
  SDL.keyboardState = _malloc(65536);
  _memset(SDL.keyboardState, 0, 65536);
  SDL.DOMEventToSDLEvent["keydown"] = 768;
  SDL.DOMEventToSDLEvent["keyup"] = 769;
  SDL.DOMEventToSDLEvent["keypress"] = 771;
  SDL.DOMEventToSDLEvent["mousedown"] = 1025;
  SDL.DOMEventToSDLEvent["mouseup"] = 1026;
  SDL.DOMEventToSDLEvent["mousemove"] = 1024;
  SDL.DOMEventToSDLEvent["wheel"] = 1027;
  SDL.DOMEventToSDLEvent["touchstart"] = 1792;
  SDL.DOMEventToSDLEvent["touchend"] = 1793;
  SDL.DOMEventToSDLEvent["touchmove"] = 1794;
  SDL.DOMEventToSDLEvent["unload"] = 256;
  SDL.DOMEventToSDLEvent["resize"] = 28673;
  SDL.DOMEventToSDLEvent["visibilitychange"] = 512;
  SDL.DOMEventToSDLEvent["focus"] = 512;
  SDL.DOMEventToSDLEvent["blur"] = 512;
  SDL.DOMEventToSDLEvent["joystick_axis_motion"] = 1536;
  SDL.DOMEventToSDLEvent["joystick_button_down"] = 1539;
  SDL.DOMEventToSDLEvent["joystick_button_up"] = 1540;
  return 0
}

function _SDL_InitSubSystem(flags) {
  return 0
}

function _SDL_JoystickClose(joystick) {
  delete SDL.lastJoystickState[joystick]
}

function _SDL_JoystickEventState(state) {
  if (state < 0) {
    return SDL.joystickEventState
  }
  return SDL.joystickEventState = state
}

function _SDL_JoystickGetAxis(joystick, axis) {
  var gamepad = SDL.getGamepad(joystick - 1);
  if (gamepad && gamepad.axes.length > axis) {
    return SDL.joystickAxisValueConversion(gamepad.axes[axis])
  }
  return 0
}

function _SDL_JoystickGetButton(joystick, button) {
  var gamepad = SDL.getGamepad(joystick - 1);
  if (gamepad && gamepad.buttons.length > button) {
    return SDL.getJoystickButtonState(gamepad.buttons[button]) ? 1 : 0
  }
  return 0
}

function _SDL_JoystickGetHat(joystick, hat) {
  return 0
}

function _SDL_JoystickName(deviceIndex) {
  var gamepad = SDL.getGamepad(deviceIndex);
  if (gamepad) {
    var name = gamepad.id;
    if (SDL.joystickNamePool.hasOwnProperty(name)) {
      return SDL.joystickNamePool[name]
    }
    return SDL.joystickNamePool[name] = allocate(intArrayFromString(name), "i8", ALLOC_NORMAL)
  }
  return 0
}

function _SDL_JoystickNumAxes(joystick) {
  var gamepad = SDL.getGamepad(joystick - 1);
  if (gamepad) {
    return gamepad.axes.length
  }
  return 0
}

function _SDL_JoystickNumButtons(joystick) {
  var gamepad = SDL.getGamepad(joystick - 1);
  if (gamepad) {
    return gamepad.buttons.length
  }
  return 0
}

function _SDL_JoystickNumHats(joystick) {
  return 0
}

function _SDL_JoystickOpen(deviceIndex) {
  var gamepad = SDL.getGamepad(deviceIndex);
  if (gamepad) {
    var joystick = deviceIndex + 1;
    SDL.recordJoystickState(joystick, gamepad);
    return joystick
  }
  return 0
}

function _SDL_JoystickUpdate() {
  SDL.queryJoysticks()
}

function _SDL_LockAudio() { }

function _SDL_MapRGB(fmt, r, g, b) {
  SDL.checkPixelFormat(fmt);
  return r & 255 | (g & 255) << 8 | (b & 255) << 16 | 4278190080
}

function _SDL_NumJoysticks() {
  var count = 0;
  var gamepads = SDL.getGamepads();
  for (var i = 0; i < gamepads.length; i++) {
    if (gamepads[i] !== undefined) count++
  }
  return count
}

function _SDL_OpenAudio(desired, obtained) {
  try {
    SDL.audio = {
      freq: HEAPU32[desired >> 2],
      format: HEAPU16[desired + 4 >> 1],
      channels: HEAPU8[desired + 6 >> 0],
      samples: HEAPU16[desired + 8 >> 1],
      callback: HEAPU32[desired + 16 >> 2],
      userdata: HEAPU32[desired + 20 >> 2],
      paused: true,
      timer: null
    };
    if (SDL.audio.format == 8) {
      SDL.audio.silence = 128
    } else if (SDL.audio.format == 32784) {
      SDL.audio.silence = 0
    } else if (SDL.audio.format == 33056) {
      SDL.audio.silence = 0
    } else {
      throw "Invalid SDL audio format " + SDL.audio.format + "!"
    }
    if (SDL.audio.freq <= 0) {
      throw "Unsupported sound frequency " + SDL.audio.freq + "!"
    } else if (SDL.audio.freq <= 22050) {
      SDL.audio.freq = 22050
    } else if (SDL.audio.freq <= 32e3) {
      SDL.audio.freq = 32e3
    } else if (SDL.audio.freq <= 44100) {
      SDL.audio.freq = 44100
    } else if (SDL.audio.freq <= 48e3) {
      SDL.audio.freq = 48e3
    } else if (SDL.audio.freq <= 96e3) {
      SDL.audio.freq = 96e3
    } else {
      throw "Unsupported sound frequency " + SDL.audio.freq + "!"
    }
    if (SDL.audio.channels == 0) {
      SDL.audio.channels = 1
    } else if (SDL.audio.channels < 0 || SDL.audio.channels > 32) {
      throw "Unsupported number of audio channels for SDL audio: " + SDL.audio.channels + "!"
    } else if (SDL.audio.channels != 1 && SDL.audio.channels != 2) {
      console.log("Warning: Using untested number of audio channels " + SDL.audio.channels)
    }
    if (SDL.audio.samples < 128 || SDL.audio.samples > 524288) {
      throw "Unsupported audio callback buffer size " + SDL.audio.samples + "!"
    } else if ((SDL.audio.samples & SDL.audio.samples - 1) != 0) {
      throw "Audio callback buffer size " + SDL.audio.samples + " must be a power-of-two!"
    }
    var totalSamples = SDL.audio.samples * SDL.audio.channels;
    if (SDL.audio.format == 8) {
      SDL.audio.bytesPerSample = 1
    } else if (SDL.audio.format == 32784) {
      SDL.audio.bytesPerSample = 2
    } else if (SDL.audio.format == 33056) {
      SDL.audio.bytesPerSample = 4
    } else {
      throw "Invalid SDL audio format " + SDL.audio.format + "!"
    }
    SDL.audio.bufferSize = totalSamples * SDL.audio.bytesPerSample;
    SDL.audio.bufferDurationSecs = SDL.audio.bufferSize / SDL.audio.bytesPerSample / SDL.audio.channels / SDL.audio.freq;
    SDL.audio.bufferingDelay = 50 / 1e3;
    SDL.audio.buffer = _malloc(SDL.audio.bufferSize);
    SDL.audio.numSimultaneouslyQueuedBuffers = Module["SDL_numSimultaneouslyQueuedBuffers"] || 5;
    SDL.audio.queueNewAudioData = function SDL_queueNewAudioData() {
      if (!SDL.audio) return;
      for (var i = 0; i < SDL.audio.numSimultaneouslyQueuedBuffers; ++i) {
        var secsUntilNextPlayStart = SDL.audio.nextPlayTime - SDL.audioContext["currentTime"];
        if (secsUntilNextPlayStart >= SDL.audio.bufferingDelay + SDL.audio.bufferDurationSecs * SDL.audio.numSimultaneouslyQueuedBuffers) return;
        dynCall_viii(SDL.audio.callback, SDL.audio.userdata, SDL.audio.buffer, SDL.audio.bufferSize);
        SDL.audio.pushAudio(SDL.audio.buffer, SDL.audio.bufferSize)
      }
    };
    var yieldCallback = function () {
      if (SDL.audio && SDL.audio.queueNewAudioData) SDL.audio.queueNewAudioData()
    };
    SDL.audio.yieldCallback = yieldCallback;
    EmterpreterAsync.yieldCallbacks.push(yieldCallback);
    SDL.audio.caller = function SDL_audioCaller() {
      if (!SDL.audio) return;
      --SDL.audio.numAudioTimersPending;
      SDL.audio.queueNewAudioData();
      var secsUntilNextPlayStart = SDL.audio.nextPlayTime - SDL.audioContext["currentTime"];
      var preemptBufferFeedSecs = SDL.audio.bufferDurationSecs / 2;
      if (SDL.audio.numAudioTimersPending < SDL.audio.numSimultaneouslyQueuedBuffers) {
        ++SDL.audio.numAudioTimersPending;
        SDL.audio.timer = Browser.safeSetTimeout(SDL.audio.caller, Math.max(0, 1e3 * (secsUntilNextPlayStart - preemptBufferFeedSecs)));
        if (SDL.audio.numAudioTimersPending < SDL.audio.numSimultaneouslyQueuedBuffers) {
          ++SDL.audio.numAudioTimersPending;
          Browser.safeSetTimeout(SDL.audio.caller, 1)
        }
      }
    };
    SDL.audio.audioOutput = new Audio;
    SDL.openAudioContext();
    if (!SDL.audioContext) throw "Web Audio API is not available!";
    SDL.audio.nextPlayTime = 0;
    SDL.audio.pushAudio = function (ptr, sizeBytes) {
      return;
      try {
        if (SDL.audio.paused) return;
        var sizeSamples = sizeBytes / SDL.audio.bytesPerSample;
        var sizeSamplesPerChannel = sizeSamples / SDL.audio.channels;
        if (sizeSamplesPerChannel != SDL.audio.samples) {
          throw "Received mismatching audio buffer size!"
        }
        var source = SDL.audioContext["createBufferSource"]();
        var soundBuffer = SDL.audioContext["createBuffer"](SDL.audio.channels, sizeSamplesPerChannel, SDL.audio.freq);
        source["connect"](SDL.audioContext["destination"]);
        SDL.fillWebAudioBufferFromHeap(ptr, sizeSamplesPerChannel, soundBuffer);
        source["buffer"] = soundBuffer;
        var curtime = SDL.audioContext["currentTime"];
        var playtime = Math.max(curtime + SDL.audio.bufferingDelay, SDL.audio.nextPlayTime);
        if (typeof source["start"] !== "undefined") {
          source["start"](playtime)
        } else if (typeof source["noteOn"] !== "undefined") {
          source["noteOn"](playtime)
        }
        SDL.audio.nextPlayTime = playtime + SDL.audio.bufferDurationSecs
      } catch (e) {
        console.log("Web Audio API error playing back audio: " + e.toString())
      }
    };
    if (obtained) {
      HEAP32[obtained >> 2] = SDL.audio.freq;
      HEAP16[obtained + 4 >> 1] = SDL.audio.format;
      HEAP8[obtained + 6 >> 0] = SDL.audio.channels;
      HEAP8[obtained + 7 >> 0] = SDL.audio.silence;
      HEAP16[obtained + 8 >> 1] = SDL.audio.samples;
      HEAP32[obtained + 16 >> 2] = SDL.audio.callback;
      HEAP32[obtained + 20 >> 2] = SDL.audio.userdata
    }
    SDL.allocateChannels(32)
  } catch (e) {
    console.log('Initializing SDL audio threw an exception: "' + e.toString() + '"! Continuing without audio.');
    SDL.audio = null;
    SDL.allocateChannels(0);
    if (obtained) {
      HEAP32[obtained >> 2] = 0;
      HEAP16[obtained + 4 >> 1] = 0;
      HEAP8[obtained + 6 >> 0] = 0;
      HEAP8[obtained + 7 >> 0] = 0;
      HEAP16[obtained + 8 >> 1] = 0;
      HEAP32[obtained + 16 >> 2] = 0;
      HEAP32[obtained + 20 >> 2] = 0
    }
  }
  if (!SDL.audio) {
    return -1
  }
  return 0
}

function _SDL_PollEvent(ptr) {
  return SDL.pollEvent(ptr)
}

function _SDL_AudioQuit() {
  for (var i = 0; i < SDL.numChannels; ++i) {
    if (SDL.channels[i].audio) {
      SDL.channels[i].audio.pause();
      SDL.channels[i].audio = undefined
    }
  }
  if (SDL.music.audio) SDL.music.audio.pause();
  SDL.music.audio = undefined
}

function _SDL_Quit() {
  _SDL_AudioQuit();
  out("SDL_Quit called (and ignored)")
}

function _SDL_SetAlpha(surf, flag, alpha) {
  var surfData = SDL.surfaces[surf];
  surfData.alpha = alpha;
  if (!(flag & 65536)) {
    surfData.alpha = 255
  }
}

function _SDL_SetColors(surf, colors, firstColor, nColors) {
  var surfData = SDL.surfaces[surf];
  if (!surfData.colors) {
    var buffer = new ArrayBuffer(256 * 4);
    surfData.colors = new Uint8Array(buffer);
    surfData.colors32 = new Uint32Array(buffer)
  }
  for (var i = 0; i < nColors; ++i) {
    var index = (firstColor + i) * 4;
    surfData.colors[index] = HEAPU8[colors + i * 4 >> 0];
    surfData.colors[index + 1] = HEAPU8[colors + (i * 4 + 1) >> 0];
    surfData.colors[index + 2] = HEAPU8[colors + (i * 4 + 2) >> 0];
    surfData.colors[index + 3] = 255
  }
  return 1
}

function _SDL_SetPalette(surf, flags, colors, firstColor, nColors) {
  return _SDL_SetColors(surf, colors, firstColor, nColors)
}
var GL = {
  counter: 1,
  lastError: 0,
  buffers: [],
  mappedBuffers: {},
  programs: [],
  framebuffers: [],
  renderbuffers: [],
  textures: [],
  uniforms: [],
  shaders: [],
  vaos: [],
  contexts: {},
  currentContext: null,
  offscreenCanvases: {},
  timerQueriesEXT: [],
  programInfos: {},
  stringCache: {},
  unpackAlignment: 4,
  init: function () {
    GL.miniTempBuffer = new Float32Array(GL.MINI_TEMP_BUFFER_SIZE);
    for (var i = 0; i < GL.MINI_TEMP_BUFFER_SIZE; i++) {
      GL.miniTempBufferViews[i] = GL.miniTempBuffer.subarray(0, i + 1)
    }
  },
  recordError: function recordError(errorCode) {
    if (!GL.lastError) {
      GL.lastError = errorCode
    }
  },
  getNewId: function (table) {
    var ret = GL.counter++;
    for (var i = table.length; i < ret; i++) {
      table[i] = null
    }
    return ret
  },
  MINI_TEMP_BUFFER_SIZE: 256,
  miniTempBuffer: null,
  miniTempBufferViews: [0],
  getSource: function (shader, count, string, length) {
    var source = "";
    for (var i = 0; i < count; ++i) {
      var len = length ? HEAP32[length + i * 4 >> 2] : -1;
      source += UTF8ToString(HEAP32[string + i * 4 >> 2], len < 0 ? undefined : len)
    }
    return source
  },
  createContext: function (canvas, webGLContextAttributes) {
    var ctx = canvas.getContext("webgl", webGLContextAttributes) || canvas.getContext("experimental-webgl", webGLContextAttributes);
    if (!ctx) return 0;
    var handle = GL.registerContext(ctx, webGLContextAttributes);
    return handle
  },
  registerContext: function (ctx, webGLContextAttributes) {
    var handle = _malloc(8);
    var context = {
      handle: handle,
      attributes: webGLContextAttributes,
      version: webGLContextAttributes.majorVersion,
      GLctx: ctx
    };
    if (ctx.canvas) ctx.canvas.GLctxObject = context;
    GL.contexts[handle] = context;
    if (typeof webGLContextAttributes.enableExtensionsByDefault === "undefined" || webGLContextAttributes.enableExtensionsByDefault) {
      GL.initExtensions(context)
    }
    return handle
  },
  makeContextCurrent: function (contextHandle) {
    GL.currentContext = GL.contexts[contextHandle];
    Module.ctx = GLctx = GL.currentContext && GL.currentContext.GLctx;
    return !(contextHandle && !GLctx)
  },
  getContext: function (contextHandle) {
    return GL.contexts[contextHandle]
  },
  deleteContext: function (contextHandle) {
    if (GL.currentContext === GL.contexts[contextHandle]) GL.currentContext = null;
    if (typeof JSEvents === "object") JSEvents.removeAllHandlersOnTarget(GL.contexts[contextHandle].GLctx.canvas);
    if (GL.contexts[contextHandle] && GL.contexts[contextHandle].GLctx.canvas) GL.contexts[contextHandle].GLctx.canvas.GLctxObject = undefined;
    _free(GL.contexts[contextHandle]);
    GL.contexts[contextHandle] = null
  },
  acquireInstancedArraysExtension: function (ctx) {
    var ext = ctx.getExtension("ANGLE_instanced_arrays");
    if (ext) {
      ctx["vertexAttribDivisor"] = function (index, divisor) {
        ext["vertexAttribDivisorANGLE"](index, divisor)
      };
      ctx["drawArraysInstanced"] = function (mode, first, count, primcount) {
        ext["drawArraysInstancedANGLE"](mode, first, count, primcount)
      };
      ctx["drawElementsInstanced"] = function (mode, count, type, indices, primcount) {
        ext["drawElementsInstancedANGLE"](mode, count, type, indices, primcount)
      }
    }
  },
  acquireVertexArrayObjectExtension: function (ctx) {
    var ext = ctx.getExtension("OES_vertex_array_object");
    if (ext) {
      ctx["createVertexArray"] = function () {
        return ext["createVertexArrayOES"]()
      };
      ctx["deleteVertexArray"] = function (vao) {
        ext["deleteVertexArrayOES"](vao)
      };
      ctx["bindVertexArray"] = function (vao) {
        ext["bindVertexArrayOES"](vao)
      };
      ctx["isVertexArray"] = function (vao) {
        return ext["isVertexArrayOES"](vao)
      }
    }
  },
  acquireDrawBuffersExtension: function (ctx) {
    var ext = ctx.getExtension("WEBGL_draw_buffers");
    if (ext) {
      ctx["drawBuffers"] = function (n, bufs) {
        ext["drawBuffersWEBGL"](n, bufs)
      }
    }
  },
  initExtensions: function (context) {
    if (!context) context = GL.currentContext;
    if (context.initExtensionsDone) return;
    context.initExtensionsDone = true;
    var GLctx = context.GLctx;
    if (context.version < 2) {
      GL.acquireInstancedArraysExtension(GLctx);
      GL.acquireVertexArrayObjectExtension(GLctx);
      GL.acquireDrawBuffersExtension(GLctx)
    }
    GLctx.disjointTimerQueryExt = GLctx.getExtension("EXT_disjoint_timer_query");
    var automaticallyEnabledExtensions = ["OES_texture_float", "OES_texture_half_float", "OES_standard_derivatives", "OES_vertex_array_object", "WEBGL_compressed_texture_s3tc", "WEBGL_depth_texture", "OES_element_index_uint", "EXT_texture_filter_anisotropic", "EXT_frag_depth", "WEBGL_draw_buffers", "ANGLE_instanced_arrays", "OES_texture_float_linear", "OES_texture_half_float_linear", "EXT_blend_minmax", "EXT_shader_texture_lod", "WEBGL_compressed_texture_pvrtc", "EXT_color_buffer_half_float", "WEBGL_color_buffer_float", "EXT_sRGB", "WEBGL_compressed_texture_etc1", "EXT_disjoint_timer_query", "WEBGL_compressed_texture_etc", "WEBGL_compressed_texture_astc", "EXT_color_buffer_float", "WEBGL_compressed_texture_s3tc_srgb", "EXT_disjoint_timer_query_webgl2"];
    var exts = GLctx.getSupportedExtensions() || [];
    exts.forEach(function (ext) {
      if (automaticallyEnabledExtensions.indexOf(ext) != -1) {
        GLctx.getExtension(ext)
      }
    })
  },
  populateUniformTable: function (program) {
    var p = GL.programs[program];
    var ptable = GL.programInfos[program] = {
      uniforms: {},
      maxUniformLength: 0,
      maxAttributeLength: -1,
      maxUniformBlockNameLength: -1
    };
    var utable = ptable.uniforms;
    var numUniforms = GLctx.getProgramParameter(p, 35718);
    for (var i = 0; i < numUniforms; ++i) {
      var u = GLctx.getActiveUniform(p, i);
      var name = u.name;
      ptable.maxUniformLength = Math.max(ptable.maxUniformLength, name.length + 1);
      if (name.slice(-1) == "]") {
        name = name.slice(0, name.lastIndexOf("["))
      }
      var loc = GLctx.getUniformLocation(p, name);
      if (loc) {
        var id = GL.getNewId(GL.uniforms);
        utable[name] = [u.size, id];
        GL.uniforms[id] = loc;
        for (var j = 1; j < u.size; ++j) {
          var n = name + "[" + j + "]";
          loc = GLctx.getUniformLocation(p, n);
          id = GL.getNewId(GL.uniforms);
          GL.uniforms[id] = loc
        }
      }
    }
  }
};

function _SDL_SetVideoMode(width, height, depth, flags) {
  ["touchstart", "touchend", "touchmove", "mousedown", "mouseup", "mousemove", "DOMMouseScroll", "mousewheel", "wheel", "mouseout"].forEach(function (event) {
    Module["canvas"].addEventListener(event, SDL.receiveEvent, true)
  });
  var canvas = Module["canvas"];
  if (width == 0 && height == 0) {
    width = canvas.width;
    height = canvas.height
  }
  if (!SDL.addedResizeListener) {
    SDL.addedResizeListener = true;
    Browser.resizeListeners.push(function (w, h) {
      if (!SDL.settingVideoMode) {
        SDL.receiveEvent({
          type: "resize",
          w: w,
          h: h
        })
      }
    })
  }
  SDL.settingVideoMode = true;
  Browser.setCanvasSize(width, height);
  SDL.settingVideoMode = false;
  if (SDL.screen) {
    SDL.freeSurface(SDL.screen);
    assert(!SDL.screen)
  }
  if (SDL.GL) flags = flags | 67108864;
  SDL.screen = SDL.makeSurface(width, height, flags, true, "screen");
  return SDL.screen
}

function _SDL_ShowCursor(toggle) {
  switch (toggle) {
    case 0:
      if (Browser.isFullscreen) {
        Module["canvas"].requestPointerLock();
        return 0
      } else {
        return 1
      }
      break;
    case 1:
      Module["canvas"].exitPointerLock();
      return 1;
      break;
    case -1:
      return !Browser.pointerLock;
      break;
    default:
      console.log("SDL_ShowCursor called with unknown toggle parameter value: " + toggle + ".");
      break
  }
}

function _SDL_UnlockAudio() { }

function _SDL_UnlockSurface(surf) {
  assert(!SDL.GL);
  var surfData = SDL.surfaces[surf];
  if (!surfData.locked || --surfData.locked > 0) {
    return
  }
  if (surfData.isFlagSet(2097152)) {
    SDL.copyIndexedColorData(surfData)
  } else if (!surfData.colors) {
    var data = surfData.image.data;
    var buffer = surfData.buffer;
    assert(buffer % 4 == 0, "Invalid buffer offset: " + buffer);
    var src = buffer >> 2;
    var dst = 0;
    var isScreen = surf == SDL.screen;
    var num;
    if (typeof CanvasPixelArray !== "undefined" && data instanceof CanvasPixelArray) {
      num = data.length;
      while (dst < num) {
        var val = HEAP32[src];
        data[dst] = val & 255;
        data[dst + 1] = val >> 8 & 255;
        data[dst + 2] = val >> 16 & 255;
        data[dst + 3] = isScreen ? 255 : val >> 24 & 255;
        src++;
        dst += 4
      }
    } else {
      var data32 = new Uint32Array(data.buffer);
      if (isScreen && SDL.defaults.opaqueFrontBuffer) {
        num = data32.length;
        data32.set(HEAP32.subarray(src, src + num));
        var data8 = new Uint8Array(data.buffer);
        var i = 3;
        var j = i + 4 * num;
        if (num % 8 == 0) {
          while (i < j) {
            data8[i] = 255;
            i = i + 4 | 0;
            data8[i] = 255;
            i = i + 4 | 0;
            data8[i] = 255;
            i = i + 4 | 0;
            data8[i] = 255;
            i = i + 4 | 0;
            data8[i] = 255;
            i = i + 4 | 0;
            data8[i] = 255;
            i = i + 4 | 0;
            data8[i] = 255;
            i = i + 4 | 0;
            data8[i] = 255;
            i = i + 4 | 0
          }
        } else {
          while (i < j) {
            data8[i] = 255;
            i = i + 4 | 0
          }
        }
      } else {
        data32.set(HEAP32.subarray(src, src + data32.length))
      }
    }
  } else {
    var width = Module["canvas"].width;
    var height = Module["canvas"].height;
    var s = surfData.buffer;
    var data = surfData.image.data;
    var colors = surfData.colors;
    for (var y = 0; y < height; y++) {
      var base = y * width * 4;
      for (var x = 0; x < width; x++) {
        var val = HEAPU8[s++ >> 0] * 4;
        var start = base + x * 4;
        data[start] = colors[val];
        data[start + 1] = colors[val + 1];
        data[start + 2] = colors[val + 2]
      }
      s += width * 3
    }
  }
  surfData.ctx.putImageData(surfData.image, 0, 0)
}

function _SDL_UpperBlit(src, srcrect, dst, dstrect) {
  return SDL.blitSurface(src, srcrect, dst, dstrect, false)
}

function _SDL_VideoModeOK(width, height, depth, flags) {
  return depth
}

function _SDL_WM_GrabInput() { }

function _SDL_WM_SetCaption(title, icon) {
  if (title && typeof setWindowTitle !== "undefined") {
    setWindowTitle(UTF8ToString(title))
  }
  icon = icon && UTF8ToString(icon)
}

function _SDL_WaitEvent() {
  err("missing function: SDL_WaitEvent");
  abort(-1)
}

function ___assert_fail(condition, filename, line, func) {
  abort("Assertion failed: " + UTF8ToString(condition) + ", at: " + [filename ? UTF8ToString(filename) : "unknown filename", line, func ? UTF8ToString(func) : "unknown function"])
}
var ENV = {};

function ___buildEnvironment(environ) {
  var MAX_ENV_VALUES = 64;
  var TOTAL_ENV_SIZE = 1024;
  var poolPtr;
  var envPtr;
  if (!___buildEnvironment.called) {
    ___buildEnvironment.called = true;
    ENV["USER"] = "web_user";
    ENV["LOGNAME"] = "web_user";
    ENV["PATH"] = "/";
    ENV["PWD"] = "/";
    ENV["HOME"] = "/home/web_user";
    ENV["LANG"] = (typeof navigator === "object" && navigator.languages && navigator.languages[0] || "C").replace("-", "_") + ".UTF-8";
    ENV["_"] = thisProgram;
    poolPtr = getMemory(TOTAL_ENV_SIZE);
    envPtr = getMemory(MAX_ENV_VALUES * 4);
    HEAP32[envPtr >> 2] = poolPtr;
    HEAP32[environ >> 2] = envPtr
  } else {
    envPtr = HEAP32[environ >> 2];
    poolPtr = HEAP32[envPtr >> 2]
  }
  var strings = [];
  var totalSize = 0;
  for (var key in ENV) {
    if (typeof ENV[key] === "string") {
      var line = key + "=" + ENV[key];
      strings.push(line);
      totalSize += line.length
    }
  }
  if (totalSize > TOTAL_ENV_SIZE) {
    throw new Error("Environment size exceeded TOTAL_ENV_SIZE!")
  }
  var ptrSize = 4;
  for (var i = 0; i < strings.length; i++) {
    var line = strings[i];
    writeAsciiToMemory(line, poolPtr);
    HEAP32[envPtr + i * ptrSize >> 2] = poolPtr;
    poolPtr += line.length + 1
  }
  HEAP32[envPtr + strings.length * ptrSize >> 2] = 0
}

function ___cxa_allocate_exception(size) {
  return _malloc(size)
}
var ___exception_infos = {};
var ___exception_last = 0;

function ___cxa_throw(ptr, type, destructor) {
  ___exception_infos[ptr] = {
    ptr: ptr,
    adjusted: [ptr],
    type: type,
    destructor: destructor,
    refcount: 0,
    caught: false,
    rethrown: false
  };
  ___exception_last = ptr;
  if (!("uncaught_exception" in __ZSt18uncaught_exceptionv)) {
    __ZSt18uncaught_exceptionv.uncaught_exceptions = 1
  } else {
    __ZSt18uncaught_exceptionv.uncaught_exceptions++
  }
  throw ptr
}

function ___lock() { }

function ___map_file(pathname, size) {
  ___setErrNo(63);
  return -1
}
var SYSCALLS = {
  DEFAULT_POLLMASK: 5,
  mappings: {},
  umask: 511,
  calculateAt: function (dirfd, path) {
    if (path[0] !== "/") {
      var dir;
      if (dirfd === -100) {
        dir = FS.cwd()
      } else {
        var dirstream = FS.getStream(dirfd);
        if (!dirstream) throw new FS.ErrnoError(8);
        dir = dirstream.path
      }
      path = PATH.join2(dir, path)
    }
    return path
  },
  doStat: function (func, path, buf) {
    try {
      var stat = func(path)
    } catch (e) {
      if (e && e.node && PATH.normalize(path) !== PATH.normalize(FS.getPath(e.node))) {
        return -54
      }
      throw e
    }
    HEAP32[buf >> 2] = stat.dev;
    HEAP32[buf + 4 >> 2] = 0;
    HEAP32[buf + 8 >> 2] = stat.ino;
    HEAP32[buf + 12 >> 2] = stat.mode;
    HEAP32[buf + 16 >> 2] = stat.nlink;
    HEAP32[buf + 20 >> 2] = stat.uid;
    HEAP32[buf + 24 >> 2] = stat.gid;
    HEAP32[buf + 28 >> 2] = stat.rdev;
    HEAP32[buf + 32 >> 2] = 0;
    tempI64 = [stat.size >>> 0, (tempDouble = stat.size, +Math_abs(tempDouble) >= +1 ? tempDouble > +0 ? (Math_min(+Math_floor(tempDouble / +4294967296), +4294967295) | 0) >>> 0 : ~~+Math_ceil((tempDouble - +(~~tempDouble >>> 0)) / +4294967296) >>> 0 : 0)], HEAP32[buf + 40 >> 2] = tempI64[0], HEAP32[buf + 44 >> 2] = tempI64[1];
    HEAP32[buf + 48 >> 2] = 4096;
    HEAP32[buf + 52 >> 2] = stat.blocks;
    HEAP32[buf + 56 >> 2] = stat.atime.getTime() / 1e3 | 0;
    HEAP32[buf + 60 >> 2] = 0;
    HEAP32[buf + 64 >> 2] = stat.mtime.getTime() / 1e3 | 0;
    HEAP32[buf + 68 >> 2] = 0;
    HEAP32[buf + 72 >> 2] = stat.ctime.getTime() / 1e3 | 0;
    HEAP32[buf + 76 >> 2] = 0;
    tempI64 = [stat.ino >>> 0, (tempDouble = stat.ino, +Math_abs(tempDouble) >= +1 ? tempDouble > +0 ? (Math_min(+Math_floor(tempDouble / +4294967296), +4294967295) | 0) >>> 0 : ~~+Math_ceil((tempDouble - +(~~tempDouble >>> 0)) / +4294967296) >>> 0 : 0)], HEAP32[buf + 80 >> 2] = tempI64[0], HEAP32[buf + 84 >> 2] = tempI64[1];
    return 0
  },
  doMsync: function (addr, stream, len, flags) {
    var buffer = new Uint8Array(HEAPU8.subarray(addr, addr + len));
    FS.msync(stream, buffer, 0, len, flags)
  },
  doMkdir: function (path, mode) {
    path = PATH.normalize(path);
    if (path[path.length - 1] === "/") path = path.substr(0, path.length - 1);
    FS.mkdir(path, mode, 0);
    return 0
  },
  doMknod: function (path, mode, dev) {
    switch (mode & 61440) {
      case 32768:
      case 8192:
      case 24576:
      case 4096:
      case 49152:
        break;
      default:
        return -28
    }
    FS.mknod(path, mode, dev);
    return 0
  },
  doReadlink: function (path, buf, bufsize) {
    if (bufsize <= 0) return -28;
    var ret = FS.readlink(path);
    var len = Math.min(bufsize, lengthBytesUTF8(ret));
    var endChar = HEAP8[buf + len];
    stringToUTF8(ret, buf, bufsize + 1);
    HEAP8[buf + len] = endChar;
    return len
  },
  doAccess: function (path, amode) {
    if (amode & ~7) {
      return -28
    }
    var node;
    var lookup = FS.lookupPath(path, {
      follow: true
    });
    node = lookup.node;
    if (!node) {
      return -44
    }
    var perms = "";
    if (amode & 4) perms += "r";
    if (amode & 2) perms += "w";
    if (amode & 1) perms += "x";
    if (perms && FS.nodePermissions(node, perms)) {
      return -2
    }
    return 0
  },
  doDup: function (path, flags, suggestFD) {
    var suggest = FS.getStream(suggestFD);
    if (suggest) FS.close(suggest);
    return FS.open(path, flags, 0, suggestFD, suggestFD).fd
  },
  doReadv: function (stream, iov, iovcnt, offset) {
    var ret = 0;
    for (var i = 0; i < iovcnt; i++) {
      var ptr = HEAP32[iov + i * 8 >> 2];
      var len = HEAP32[iov + (i * 8 + 4) >> 2];
      var curr = FS.read(stream, HEAP8, ptr, len, offset);
      if (curr < 0) return -1;
      ret += curr;
      if (curr < len) break
    }
    return ret
  },
  doWritev: function (stream, iov, iovcnt, offset) {
    var ret = 0;
    for (var i = 0; i < iovcnt; i++) {
      var ptr = HEAP32[iov + i * 8 >> 2];
      var len = HEAP32[iov + (i * 8 + 4) >> 2];
      var curr = FS.write(stream, HEAP8, ptr, len, offset);
      if (curr < 0) return -1;
      ret += curr
    }
    return ret
  },
  varargs: 0,
  get: function (varargs) {
    SYSCALLS.varargs += 4;
    var ret = HEAP32[SYSCALLS.varargs - 4 >> 2];
    return ret
  },
  getStr: function () {
    var ret = UTF8ToString(SYSCALLS.get());
    return ret
  },
  getStreamFromFD: function (fd) {
    if (fd === undefined) fd = SYSCALLS.get();
    var stream = FS.getStream(fd);
    if (!stream) throw new FS.ErrnoError(8);
    return stream
  },
  get64: function () {
    var low = SYSCALLS.get(),
      high = SYSCALLS.get();
    return low
  },
  getZero: function () {
    SYSCALLS.get()
  }
};

function ___syscall10(which, varargs) {
  SYSCALLS.varargs = varargs;
  try {
    var path = SYSCALLS.getStr();
    FS.unlink(path);
    return 0
  } catch (e) {
    if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno
  }
}

function ___syscall15(which, varargs) {
  SYSCALLS.varargs = varargs;
  try {
    var path = SYSCALLS.getStr(),
      mode = SYSCALLS.get();
    FS.chmod(path, mode);
    return 0
  } catch (e) {
    if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno
  }
}

function ___syscall183(which, varargs) {
  SYSCALLS.varargs = varargs;
  try {
    var buf = SYSCALLS.get(),
      size = SYSCALLS.get();
    if (size === 0) return -28;
    var cwd = FS.cwd();
    var cwdLengthInBytes = lengthBytesUTF8(cwd);
    if (size < cwdLengthInBytes + 1) return -68;
    stringToUTF8(cwd, buf, size);
    return buf
  } catch (e) {
    if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno
  }
}

function ___syscall194(which, varargs) {
  SYSCALLS.varargs = varargs;
  try {
    var fd = SYSCALLS.get(),
      zero = SYSCALLS.getZero(),
      length = SYSCALLS.get64();
    FS.ftruncate(fd, length);
    return 0
  } catch (e) {
    if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno
  }
}

function ___syscall195(which, varargs) {
  SYSCALLS.varargs = varargs;
  try {
    var path = SYSCALLS.getStr(),
      buf = SYSCALLS.get();
    return SYSCALLS.doStat(FS.stat, path, buf)
  } catch (e) {
    if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno
  }
}

function ___syscall197(which, varargs) {
  SYSCALLS.varargs = varargs;
  try {
    var stream = SYSCALLS.getStreamFromFD(),
      buf = SYSCALLS.get();
    return SYSCALLS.doStat(FS.stat, stream.path, buf)
  } catch (e) {
    if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno
  }
}
var PROCINFO = {
  ppid: 1,
  pid: 42,
  sid: 42,
  pgid: 42
};

function ___syscall20(which, varargs) {
  SYSCALLS.varargs = varargs;
  try {
    return PROCINFO.pid
  } catch (e) {
    if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno
  }
}

function ___syscall220(which, varargs) {
  SYSCALLS.varargs = varargs;
  try {
    var stream = SYSCALLS.getStreamFromFD(),
      dirp = SYSCALLS.get(),
      count = SYSCALLS.get();
    if (!stream.getdents) {
      stream.getdents = FS.readdir(stream.path)
    }
    var struct_size = 280;
    var pos = 0;
    var off = FS.llseek(stream, 0, 1);
    var idx = Math.floor(off / struct_size);
    while (idx < stream.getdents.length && pos + struct_size <= count) {
      var id;
      var type;
      var name = stream.getdents[idx];
      if (name[0] === ".") {
        id = 1;
        type = 4
      } else {
        var child = FS.lookupNode(stream.node, name);
        id = child.id;
        type = FS.isChrdev(child.mode) ? 2 : FS.isDir(child.mode) ? 4 : FS.isLink(child.mode) ? 10 : 8
      }
      tempI64 = [id >>> 0, (tempDouble = id, +Math_abs(tempDouble) >= +1 ? tempDouble > +0 ? (Math_min(+Math_floor(tempDouble / +4294967296), +4294967295) | 0) >>> 0 : ~~+Math_ceil((tempDouble - +(~~tempDouble >>> 0)) / +4294967296) >>> 0 : 0)], HEAP32[dirp + pos >> 2] = tempI64[0], HEAP32[dirp + pos + 4 >> 2] = tempI64[1];
      tempI64 = [(idx + 1) * struct_size >>> 0, (tempDouble = (idx + 1) * struct_size, +Math_abs(tempDouble) >= +1 ? tempDouble > +0 ? (Math_min(+Math_floor(tempDouble / +4294967296), +4294967295) | 0) >>> 0 : ~~+Math_ceil((tempDouble - +(~~tempDouble >>> 0)) / +4294967296) >>> 0 : 0)], HEAP32[dirp + pos + 8 >> 2] = tempI64[0], HEAP32[dirp + pos + 12 >> 2] = tempI64[1];
      HEAP16[dirp + pos + 16 >> 1] = 280;
      HEAP8[dirp + pos + 18 >> 0] = type;
      stringToUTF8(name, dirp + pos + 19, 256);
      pos += struct_size;
      idx += 1
    }
    FS.llseek(stream, idx * struct_size, 0);
    return pos
  } catch (e) {
    if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno
  }
}

function ___syscall221(which, varargs) {
  SYSCALLS.varargs = varargs;
  try {
    var stream = SYSCALLS.getStreamFromFD(),
      cmd = SYSCALLS.get();
    switch (cmd) {
      case 0: {
        var arg = SYSCALLS.get();
        if (arg < 0) {
          return -28
        }
        var newStream;
        newStream = FS.open(stream.path, stream.flags, 0, arg);
        return newStream.fd
      }
      case 1:
      case 2:
        return 0;
      case 3:
        return stream.flags;
      case 4: {
        var arg = SYSCALLS.get();
        stream.flags |= arg;
        return 0
      }
      case 12: {
        var arg = SYSCALLS.get();
        var offset = 0;
        HEAP16[arg + offset >> 1] = 2;
        return 0
      }
      case 13:
      case 14:
        return 0;
      case 16:
      case 8:
        return -28;
      case 9:
        ___setErrNo(28);
        return -1;
      default: {
        return -28
      }
    }
  } catch (e) {
    if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno
  }
}

function ___syscall33(which, varargs) {
  SYSCALLS.varargs = varargs;
  try {
    var path = SYSCALLS.getStr(),
      amode = SYSCALLS.get();
    return SYSCALLS.doAccess(path, amode)
  } catch (e) {
    if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno
  }
}

function ___syscall38(which, varargs) {
  SYSCALLS.varargs = varargs;
  try {
    var old_path = SYSCALLS.getStr(),
      new_path = SYSCALLS.getStr();
    FS.rename(old_path, new_path);
    return 0
  } catch (e) {
    if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno
  }
}

function ___syscall39(which, varargs) {
  SYSCALLS.varargs = varargs;
  try {
    var path = SYSCALLS.getStr(),
      mode = SYSCALLS.get();
    return SYSCALLS.doMkdir(path, mode)
  } catch (e) {
    if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno
  }
}

function ___syscall4(which, varargs) {
  SYSCALLS.varargs = varargs;
  try {
    var stream = SYSCALLS.getStreamFromFD(),
      buf = SYSCALLS.get(),
      count = SYSCALLS.get();
    return FS.write(stream, HEAP8, buf, count)
  } catch (e) {
    if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno
  }
}

function ___syscall40(which, varargs) {
  SYSCALLS.varargs = varargs;
  try {
    var path = SYSCALLS.getStr();
    FS.rmdir(path);
    return 0
  } catch (e) {
    if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno
  }
}

function ___syscall5(which, varargs) {
  SYSCALLS.varargs = varargs;
  try {
    var pathname = SYSCALLS.getStr(),
      flags = SYSCALLS.get(),
      mode = SYSCALLS.get();
    var stream = FS.open(pathname, flags, mode);
    return stream.fd
  } catch (e) {
    if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno
  }
}

function ___syscall54(which, varargs) {
  SYSCALLS.varargs = varargs;
  try {
    var stream = SYSCALLS.getStreamFromFD(),
      op = SYSCALLS.get();
    switch (op) {
      case 21509:
      case 21505: {
        if (!stream.tty) return -59;
        return 0
      }
      case 21510:
      case 21511:
      case 21512:
      case 21506:
      case 21507:
      case 21508: {
        if (!stream.tty) return -59;
        return 0
      }
      case 21519: {
        if (!stream.tty) return -59;
        var argp = SYSCALLS.get();
        HEAP32[argp >> 2] = 0;
        return 0
      }
      case 21520: {
        if (!stream.tty) return -59;
        return -28
      }
      case 21531: {
        var argp = SYSCALLS.get();
        return FS.ioctl(stream, op, argp)
      }
      case 21523: {
        if (!stream.tty) return -59;
        return 0
      }
      case 21524: {
        if (!stream.tty) return -59;
        return 0
      }
      default:
        abort("bad ioctl syscall " + op)
    }
  } catch (e) {
    if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno
  }
}

function ___syscall60(which, varargs) {
  SYSCALLS.varargs = varargs;
  try {
    var mask = SYSCALLS.get();
    var old = SYSCALLS.umask;
    SYSCALLS.umask = mask;
    return old
  } catch (e) {
    if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno
  }
}

function __emscripten_syscall_munmap(addr, len) {
  if (addr === -1 || len === 0) {
    return -28
  }
  var info = SYSCALLS.mappings[addr];
  if (!info) return 0;
  if (len === info.len) {
    var stream = FS.getStream(info.fd);
    SYSCALLS.doMsync(addr, stream, len, info.flags);
    FS.munmap(stream);
    SYSCALLS.mappings[addr] = null;
    if (info.allocated) {
      _free(info.malloc)
    }
  }
  return 0
}

function ___syscall91(which, varargs) {
  SYSCALLS.varargs = varargs;
  try {
    var addr = SYSCALLS.get(),
      len = SYSCALLS.get();
    return __emscripten_syscall_munmap(addr, len)
  } catch (e) {
    if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno
  }
}

function ___unlock() { }

function _fd_close(fd) {
  try {
    var stream = SYSCALLS.getStreamFromFD(fd);
    FS.close(stream);
    return 0
  } catch (e) {
    if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
    return e.errno
  }
}

function ___wasi_fd_close() {
  return _fd_close.apply(null, arguments)
}

function _fd_read(fd, iov, iovcnt, pnum) {
  try {
    var stream = SYSCALLS.getStreamFromFD(fd);
    var num = SYSCALLS.doReadv(stream, iov, iovcnt);
    HEAP32[pnum >> 2] = num;
    return 0
  } catch (e) {
    if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
    return e.errno
  }
}

function ___wasi_fd_read() {
  return _fd_read.apply(null, arguments)
}

function _fd_seek(fd, offset_low, offset_high, whence, newOffset) {
  try {
    var stream = SYSCALLS.getStreamFromFD(fd);
    var HIGH_OFFSET = 4294967296;
    var offset = offset_high * HIGH_OFFSET + (offset_low >>> 0);
    var DOUBLE_LIMIT = 9007199254740992;
    if (offset <= -DOUBLE_LIMIT || offset >= DOUBLE_LIMIT) {
      return -61
    }
    FS.llseek(stream, offset, whence);
    tempI64 = [stream.position >>> 0, (tempDouble = stream.position, +Math_abs(tempDouble) >= +1 ? tempDouble > +0 ? (Math_min(+Math_floor(tempDouble / +4294967296), +4294967295) | 0) >>> 0 : ~~+Math_ceil((tempDouble - +(~~tempDouble >>> 0)) / +4294967296) >>> 0 : 0)], HEAP32[newOffset >> 2] = tempI64[0], HEAP32[newOffset + 4 >> 2] = tempI64[1];
    if (stream.getdents && offset === 0 && whence === 0) stream.getdents = null;
    return 0
  } catch (e) {
    if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
    return e.errno
  }
}

function ___wasi_fd_seek() {
  return _fd_seek.apply(null, arguments)
}

function _fd_write(fd, iov, iovcnt, pnum) {
  try {
    var stream = SYSCALLS.getStreamFromFD(fd);
    var num = SYSCALLS.doWritev(stream, iov, iovcnt);
    HEAP32[pnum >> 2] = num;
    return 0
  } catch (e) {
    if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
    return e.errno
  }
}

function ___wasi_fd_write() {
  return _fd_write.apply(null, arguments)
}

function _abort() {
  abort()
}

function _emscripten_get_now_is_monotonic() {
  return 0 || ENVIRONMENT_IS_NODE || typeof dateNow !== "undefined" || typeof performance === "object" && performance && typeof performance["now"] === "function"
}

function _clock_gettime(clk_id, tp) {
  var now;
  if (clk_id === 0) {
    now = Date.now()
  } else if (clk_id === 1 && _emscripten_get_now_is_monotonic()) {
    now = _emscripten_get_now()
  } else {
    ___setErrNo(28);
    return -1
  }
  HEAP32[tp >> 2] = now / 1e3 | 0;
  HEAP32[tp + 4 >> 2] = now % 1e3 * 1e3 * 1e3 | 0;
  return 0
}

function _emscripten_cancel_main_loop() {
  Browser.mainLoop.pause();
  Browser.mainLoop.func = null
}
var JSEvents = {
  keyEvent: 0,
  mouseEvent: 0,
  wheelEvent: 0,
  uiEvent: 0,
  focusEvent: 0,
  deviceOrientationEvent: 0,
  deviceMotionEvent: 0,
  fullscreenChangeEvent: 0,
  pointerlockChangeEvent: 0,
  visibilityChangeEvent: 0,
  touchEvent: 0,
  previousFullscreenElement: null,
  previousScreenX: null,
  previousScreenY: null,
  removeEventListenersRegistered: false,
  removeAllEventListeners: function () {
    for (var i = JSEvents.eventHandlers.length - 1; i >= 0; --i) {
      JSEvents._removeHandler(i)
    }
    JSEvents.eventHandlers = [];
    JSEvents.deferredCalls = []
  },
  registerRemoveEventListeners: function () {
    if (!JSEvents.removeEventListenersRegistered) {
      __ATEXIT__.push(JSEvents.removeAllEventListeners);
      JSEvents.removeEventListenersRegistered = true
    }
  },
  deferredCalls: [],
  deferCall: function (targetFunction, precedence, argsList) {
    function arraysHaveEqualContent(arrA, arrB) {
      if (arrA.length != arrB.length) return false;
      for (var i in arrA) {
        if (arrA[i] != arrB[i]) return false
      }
      return true
    }
    for (var i in JSEvents.deferredCalls) {
      var call = JSEvents.deferredCalls[i];
      if (call.targetFunction == targetFunction && arraysHaveEqualContent(call.argsList, argsList)) {
        return
      }
    }
    JSEvents.deferredCalls.push({
      targetFunction: targetFunction,
      precedence: precedence,
      argsList: argsList
    });
    JSEvents.deferredCalls.sort(function (x, y) {
      return x.precedence < y.precedence
    })
  },
  removeDeferredCalls: function (targetFunction) {
    for (var i = 0; i < JSEvents.deferredCalls.length; ++i) {
      if (JSEvents.deferredCalls[i].targetFunction == targetFunction) {
        JSEvents.deferredCalls.splice(i, 1);
        --i
      }
    }
  },
  canPerformEventHandlerRequests: function () {
    return JSEvents.inEventHandler && JSEvents.currentEventHandler.allowsDeferredCalls
  },
  runDeferredCalls: function () {
    if (!JSEvents.canPerformEventHandlerRequests()) {
      return
    }
    for (var i = 0; i < JSEvents.deferredCalls.length; ++i) {
      var call = JSEvents.deferredCalls[i];
      JSEvents.deferredCalls.splice(i, 1);
      --i;
      call.targetFunction.apply(this, call.argsList)
    }
  },
  inEventHandler: 0,
  currentEventHandler: null,
  eventHandlers: [],
  isInternetExplorer: function () {
    return navigator.userAgent.indexOf("MSIE") !== -1 || navigator.appVersion.indexOf("Trident/") > 0
  },
  removeAllHandlersOnTarget: function (target, eventTypeString) {
    for (var i = 0; i < JSEvents.eventHandlers.length; ++i) {
      if (JSEvents.eventHandlers[i].target == target && (!eventTypeString || eventTypeString == JSEvents.eventHandlers[i].eventTypeString)) {
        JSEvents._removeHandler(i--)
      }
    }
  },
  _removeHandler: function (i) {
    var h = JSEvents.eventHandlers[i];
    h.target.removeEventListener(h.eventTypeString, h.eventListenerFunc, h.useCapture);
    JSEvents.eventHandlers.splice(i, 1)
  },
  registerOrRemoveHandler: function (eventHandler) {
    var jsEventHandler = function jsEventHandler(event) {
      ++JSEvents.inEventHandler;
      JSEvents.currentEventHandler = eventHandler;
      JSEvents.runDeferredCalls();
      eventHandler.handlerFunc(event);
      JSEvents.runDeferredCalls();
      --JSEvents.inEventHandler
    };
    if (eventHandler.callbackfunc) {
      eventHandler.eventListenerFunc = jsEventHandler;
      eventHandler.target.addEventListener(eventHandler.eventTypeString, jsEventHandler, eventHandler.useCapture);
      JSEvents.eventHandlers.push(eventHandler);
      JSEvents.registerRemoveEventListeners()
    } else {
      for (var i = 0; i < JSEvents.eventHandlers.length; ++i) {
        if (JSEvents.eventHandlers[i].target == eventHandler.target && JSEvents.eventHandlers[i].eventTypeString == eventHandler.eventTypeString) {
          JSEvents._removeHandler(i--)
        }
      }
    }
  },
  getBoundingClientRectOrZeros: function (target) {
    return target.getBoundingClientRect ? target.getBoundingClientRect() : {
      left: 0,
      top: 0
    }
  },
  pageScrollPos: function () {
    if (pageXOffset > 0 || pageYOffset > 0) {
      return [pageXOffset, pageYOffset]
    }
    if (typeof document.documentElement.scrollLeft !== "undefined" || typeof document.documentElement.scrollTop !== "undefined") {
      return [document.documentElement.scrollLeft, document.documentElement.scrollTop]
    }
    return [document.body.scrollLeft | 0, document.body.scrollTop | 0]
  },
  getNodeNameForTarget: function (target) {
    if (!target) return "";
    if (target == window) return "#window";
    if (target == screen) return "#screen";
    return target && target.nodeName ? target.nodeName : ""
  },
  tick: function () {
    if (window["performance"] && window["performance"]["now"]) return window["performance"]["now"]();
    else return Date.now()
  },
  fullscreenEnabled: function () {
    return document.fullscreenEnabled || document.mozFullScreenEnabled || document.webkitFullscreenEnabled || document.msFullscreenEnabled
  }
};

function __requestPointerLock(target) {
  if (target.requestPointerLock) {
    target.requestPointerLock()
  } else if (target.mozRequestPointerLock) {
    target.mozRequestPointerLock()
  } else if (target.webkitRequestPointerLock) {
    target.webkitRequestPointerLock()
  } else if (target.msRequestPointerLock) {
    target.msRequestPointerLock()
  } else {
    if (document.body.requestPointerLock || document.body.mozRequestPointerLock || document.body.webkitRequestPointerLock || document.body.msRequestPointerLock) {
      return -3
    } else {
      return -1
    }
  }
  return 0
}

function _emscripten_exit_pointerlock() {
  JSEvents.removeDeferredCalls(__requestPointerLock);
  if (document.exitPointerLock) {
    document.exitPointerLock()
  } else if (document.msExitPointerLock) {
    document.msExitPointerLock()
  } else if (document.mozExitPointerLock) {
    document.mozExitPointerLock()
  } else if (document.webkitExitPointerLock) {
    document.webkitExitPointerLock()
  } else {
    return -1
  }
  return 0
}

function _emscripten_fetch() {
  err("missing function: emscripten_fetch");
  abort(-1)
}

function _emscripten_fetch_attr_init() {
  err("missing function: emscripten_fetch_attr_init");
  abort(-1)
}

function _emscripten_fetch_close() {
  err("missing function: emscripten_fetch_close");
  abort(-1)
}

function _emscripten_force_exit(status) {
  noExitRuntime = false;
  exit(status)
}

function _emscripten_get_heap_size() {
  return HEAP8.length
}

function __fillPointerlockChangeEventData(eventStruct, e) {
  var pointerLockElement = document.pointerLockElement || document.mozPointerLockElement || document.webkitPointerLockElement || document.msPointerLockElement;
  var isPointerlocked = !!pointerLockElement;
  HEAP32[eventStruct >> 2] = isPointerlocked;
  var nodeName = JSEvents.getNodeNameForTarget(pointerLockElement);
  var id = pointerLockElement && pointerLockElement.id ? pointerLockElement.id : "";
  stringToUTF8(nodeName, eventStruct + 4, 128);
  stringToUTF8(id, eventStruct + 132, 128)
}

function _emscripten_get_pointerlock_status(pointerlockStatus) {
  if (pointerlockStatus) __fillPointerlockChangeEventData(pointerlockStatus);
  if (!document.body || !document.body.requestPointerLock && !document.body.mozRequestPointerLock && !document.body.webkitRequestPointerLock && !document.body.msRequestPointerLock) {
    return -1
  }
  return 0
}
var __specialEventTargets = [0, typeof document !== "undefined" ? document : 0, typeof window !== "undefined" ? window : 0];

function __findEventTarget(target) {
  try {
    if (!target) return window;
    if (typeof target === "number") target = __specialEventTargets[target] || UTF8ToString(target);
    if (target === "#window") return window;
    else if (target === "#document") return document;
    else if (target === "#screen") return screen;
    else if (target === "#canvas") return Module["canvas"];
    return typeof target === "string" ? document.getElementById(target) : target
  } catch (e) {
    return null
  }
}

function _emscripten_request_pointerlock(target, deferUntilInEventHandler) {
  if (!target) target = "#canvas";
  target = __findEventTarget(target);
  if (!target) return -4;
  if (!target.requestPointerLock && !target.mozRequestPointerLock && !target.webkitRequestPointerLock && !target.msRequestPointerLock) {
    return -1
  }
  var canPerformRequests = JSEvents.canPerformEventHandlerRequests();
  if (!canPerformRequests) {
    if (deferUntilInEventHandler) {
      JSEvents.deferCall(__requestPointerLock, 2, [target]);
      return 1
    } else {
      return -2
    }
  }
  return __requestPointerLock(target)
}

function emscripten_realloc_buffer(size) {
  try {
    wasmMemory.grow(size - buffer.byteLength + 65535 >> 16);
    updateGlobalBufferAndViews(wasmMemory.buffer);
    return 1
  } catch (e) { }
}

function _emscripten_resize_heap(requestedSize) {
  var oldSize = _emscripten_get_heap_size();
  var PAGE_MULTIPLE = 65536;
  var LIMIT = 2147483648 - PAGE_MULTIPLE;
  if (requestedSize > LIMIT) {
    return false
  }
  var MIN_TOTAL_MEMORY = 16777216;
  var newSize = Math.max(oldSize, MIN_TOTAL_MEMORY);
  while (newSize < requestedSize) {
    if (newSize <= 536870912) {
      newSize = alignUp(2 * newSize, PAGE_MULTIPLE)
    } else {
      newSize = Math.min(alignUp((3 * newSize + 2147483648) / 4, PAGE_MULTIPLE), LIMIT)
    }
  }
  var replacement = emscripten_realloc_buffer(newSize);
  if (!replacement) {
    return false
  }
  return true
}

function __fillMouseEventData(eventStruct, e, target) {
  HEAPF64[eventStruct >> 3] = JSEvents.tick();
  HEAP32[eventStruct + 8 >> 2] = e.screenX;
  HEAP32[eventStruct + 12 >> 2] = e.screenY;
  HEAP32[eventStruct + 16 >> 2] = e.clientX;
  HEAP32[eventStruct + 20 >> 2] = e.clientY;
  HEAP32[eventStruct + 24 >> 2] = e.ctrlKey;
  HEAP32[eventStruct + 28 >> 2] = e.shiftKey;
  HEAP32[eventStruct + 32 >> 2] = e.altKey;
  HEAP32[eventStruct + 36 >> 2] = e.metaKey;
  HEAP16[eventStruct + 40 >> 1] = e.button;
  HEAP16[eventStruct + 42 >> 1] = e.buttons;
  HEAP32[eventStruct + 44 >> 2] = e["movementX"] || e["mozMovementX"] || e["webkitMovementX"] || e.screenX - JSEvents.previousScreenX;
  HEAP32[eventStruct + 48 >> 2] = e["movementY"] || e["mozMovementY"] || e["webkitMovementY"] || e.screenY - JSEvents.previousScreenY;
  if (Module["canvas"]) {
    var rect = Module["canvas"].getBoundingClientRect();
    HEAP32[eventStruct + 60 >> 2] = e.clientX - rect.left;
    HEAP32[eventStruct + 64 >> 2] = e.clientY - rect.top
  } else {
    HEAP32[eventStruct + 60 >> 2] = 0;
    HEAP32[eventStruct + 64 >> 2] = 0
  }
  if (target) {
    var rect = JSEvents.getBoundingClientRectOrZeros(target);
    HEAP32[eventStruct + 52 >> 2] = e.clientX - rect.left;
    HEAP32[eventStruct + 56 >> 2] = e.clientY - rect.top
  } else {
    HEAP32[eventStruct + 52 >> 2] = 0;
    HEAP32[eventStruct + 56 >> 2] = 0
  }
  if (e.type !== "wheel" && e.type !== "mousewheel") {
    JSEvents.previousScreenX = e.screenX;
    JSEvents.previousScreenY = e.screenY
  }
}

function __registerMouseEventCallback(target, userData, useCapture, callbackfunc, eventTypeId, eventTypeString, targetThread) {
  if (!JSEvents.mouseEvent) JSEvents.mouseEvent = _malloc(72);
  target = __findEventTarget(target);
  var mouseEventHandlerFunc = function (ev) {
    var e = ev || event;
    __fillMouseEventData(JSEvents.mouseEvent, e, target);
    if (dynCall_iiii(callbackfunc, eventTypeId, JSEvents.mouseEvent, userData)) e.preventDefault()
  };
  var eventHandler = {
    target: target,
    allowsDeferredCalls: eventTypeString != "mousemove" && eventTypeString != "mouseenter" && eventTypeString != "mouseleave",
    eventTypeString: eventTypeString,
    callbackfunc: callbackfunc,
    handlerFunc: mouseEventHandlerFunc,
    useCapture: useCapture
  };
  if (JSEvents.isInternetExplorer() && eventTypeString == "mousedown") eventHandler.allowsDeferredCalls = false;
  JSEvents.registerOrRemoveHandler(eventHandler)
}

function _emscripten_set_mousedown_callback_on_thread(target, userData, useCapture, callbackfunc, targetThread) {
  __registerMouseEventCallback(target, userData, useCapture, callbackfunc, 5, "mousedown", targetThread);
  return 0
}

function __registerPointerlockChangeEventCallback(target, userData, useCapture, callbackfunc, eventTypeId, eventTypeString, targetThread) {
  if (!JSEvents.pointerlockChangeEvent) JSEvents.pointerlockChangeEvent = _malloc(260);
  var pointerlockChangeEventHandlerFunc = function (ev) {
    var e = ev || event;
    var pointerlockChangeEvent = JSEvents.pointerlockChangeEvent;
    __fillPointerlockChangeEventData(pointerlockChangeEvent, e);
    if (dynCall_iiii(callbackfunc, eventTypeId, pointerlockChangeEvent, userData)) e.preventDefault()
  };
  var eventHandler = {
    target: target,
    allowsDeferredCalls: false,
    eventTypeString: eventTypeString,
    callbackfunc: callbackfunc,
    handlerFunc: pointerlockChangeEventHandlerFunc,
    useCapture: useCapture
  };
  JSEvents.registerOrRemoveHandler(eventHandler)
}

function _emscripten_set_pointerlockchange_callback_on_thread(target, userData, useCapture, callbackfunc, targetThread) {
  if (!document || !document.body || !document.body.requestPointerLock && !document.body.mozRequestPointerLock && !document.body.webkitRequestPointerLock && !document.body.msRequestPointerLock) {
    return -1
  }
  target = target ? __findEventTarget(target) : __specialEventTargets[1];
  if (!target) return -4;
  __registerPointerlockChangeEventCallback(target, userData, useCapture, callbackfunc, 20, "pointerlockchange", targetThread);
  __registerPointerlockChangeEventCallback(target, userData, useCapture, callbackfunc, 20, "mozpointerlockchange", targetThread);
  __registerPointerlockChangeEventCallback(target, userData, useCapture, callbackfunc, 20, "webkitpointerlockchange", targetThread);
  __registerPointerlockChangeEventCallback(target, userData, useCapture, callbackfunc, 20, "mspointerlockchange", targetThread);
  return 0
}

function _emscripten_sleep_with_yield(ms) {
  EmterpreterAsync.handle(function (resume) {
    Browser.safeSetTimeout(resume, ms)
  }, true)
}

function _execl() {
  ___setErrNo(45);
  return -1
}

function _execlp() {
  return _execl.apply(null, arguments)
}

function _execvp() {
  return _execl.apply(null, arguments)
}

function _exit(status) {
  exit(status)
}

function _getenv(name) {
  if (name === 0) return 0;
  name = UTF8ToString(name);
  if (!ENV.hasOwnProperty(name)) return 0;
  if (_getenv.ret) _free(_getenv.ret);
  _getenv.ret = allocateUTF8(ENV[name]);
  return _getenv.ret
}

function _getpwnam() {
  throw "getpwnam: TODO"
}

function _llvm_exp2_f32(x) {
  return Math.pow(2, x)
}

function _llvm_exp2_f64(a0) {
  return _llvm_exp2_f32(a0)
}

function _llvm_stackrestore(p) {
  var self = _llvm_stacksave;
  var ret = self.LLVM_SAVEDSTACKS[p];
  self.LLVM_SAVEDSTACKS.splice(p, 1);
  stackRestore(ret)
}

function _llvm_stacksave() {
  var self = _llvm_stacksave;
  if (!self.LLVM_SAVEDSTACKS) {
    self.LLVM_SAVEDSTACKS = []
  }
  self.LLVM_SAVEDSTACKS.push(stackSave());
  return self.LLVM_SAVEDSTACKS.length - 1
}

function _llvm_trap() {
  abort("trap!")
}
var ___tm_current = 30094048;
var ___tm_timezone = (stringToUTF8("GMT", 30094096, 4), 30094096);

function _tzset() {
  if (_tzset.called) return;
  _tzset.called = true;
  HEAP32[__get_timezone() >> 2] = (new Date).getTimezoneOffset() * 60;
  var currentYear = (new Date).getFullYear();
  var winter = new Date(currentYear, 0, 1);
  var summer = new Date(currentYear, 6, 1);
  HEAP32[__get_daylight() >> 2] = Number(winter.getTimezoneOffset() != summer.getTimezoneOffset());

  function extractZone(date) {
    var match = date.toTimeString().match(/\(([A-Za-z ]+)\)$/);
    return match ? match[1] : "GMT"
  }
  var winterName = extractZone(winter);
  var summerName = extractZone(summer);
  var winterNamePtr = allocate(intArrayFromString(winterName), "i8", ALLOC_NORMAL);
  var summerNamePtr = allocate(intArrayFromString(summerName), "i8", ALLOC_NORMAL);
  if (summer.getTimezoneOffset() < winter.getTimezoneOffset()) {
    HEAP32[__get_tzname() >> 2] = winterNamePtr;
    HEAP32[__get_tzname() + 4 >> 2] = summerNamePtr
  } else {
    HEAP32[__get_tzname() >> 2] = summerNamePtr;
    HEAP32[__get_tzname() + 4 >> 2] = winterNamePtr
  }
}

function _localtime_r(time, tmPtr) {
  _tzset();
  var date = new Date(HEAP32[time >> 2] * 1e3);
  HEAP32[tmPtr >> 2] = date.getSeconds();
  HEAP32[tmPtr + 4 >> 2] = date.getMinutes();
  HEAP32[tmPtr + 8 >> 2] = date.getHours();
  HEAP32[tmPtr + 12 >> 2] = date.getDate();
  HEAP32[tmPtr + 16 >> 2] = date.getMonth();
  HEAP32[tmPtr + 20 >> 2] = date.getFullYear() - 1900;
  HEAP32[tmPtr + 24 >> 2] = date.getDay();
  var start = new Date(date.getFullYear(), 0, 1);
  var yday = (date.getTime() - start.getTime()) / (1e3 * 60 * 60 * 24) | 0;
  HEAP32[tmPtr + 28 >> 2] = yday;
  HEAP32[tmPtr + 36 >> 2] = -(date.getTimezoneOffset() * 60);
  var summerOffset = new Date(date.getFullYear(), 6, 1).getTimezoneOffset();
  var winterOffset = start.getTimezoneOffset();
  var dst = (summerOffset != winterOffset && date.getTimezoneOffset() == Math.min(winterOffset, summerOffset)) | 0;
  HEAP32[tmPtr + 32 >> 2] = dst;
  var zonePtr = HEAP32[__get_tzname() + (dst ? 4 : 0) >> 2];
  HEAP32[tmPtr + 40 >> 2] = zonePtr;
  return tmPtr
}

function _localtime(time) {
  return _localtime_r(time, ___tm_current)
}

function _emscripten_memcpy_big(dest, src, num) {
  HEAPU8.set(HEAPU8.subarray(src, src + num), dest)
}

function _mktime(tmPtr) {
  _tzset();
  var date = new Date(HEAP32[tmPtr + 20 >> 2] + 1900, HEAP32[tmPtr + 16 >> 2], HEAP32[tmPtr + 12 >> 2], HEAP32[tmPtr + 8 >> 2], HEAP32[tmPtr + 4 >> 2], HEAP32[tmPtr >> 2], 0);
  var dst = HEAP32[tmPtr + 32 >> 2];
  var guessedOffset = date.getTimezoneOffset();
  var start = new Date(date.getFullYear(), 0, 1);
  var summerOffset = new Date(date.getFullYear(), 6, 1).getTimezoneOffset();
  var winterOffset = start.getTimezoneOffset();
  var dstOffset = Math.min(winterOffset, summerOffset);
  if (dst < 0) {
    HEAP32[tmPtr + 32 >> 2] = Number(summerOffset != winterOffset && dstOffset == guessedOffset)
  } else if (dst > 0 != (dstOffset == guessedOffset)) {
    var nonDstOffset = Math.max(winterOffset, summerOffset);
    var trueOffset = dst > 0 ? dstOffset : nonDstOffset;
    date.setTime(date.getTime() + (trueOffset - guessedOffset) * 6e4)
  }
  HEAP32[tmPtr + 24 >> 2] = date.getDay();
  var yday = (date.getTime() - start.getTime()) / (1e3 * 60 * 60 * 24) | 0;
  HEAP32[tmPtr + 28 >> 2] = yday;
  return date.getTime() / 1e3 | 0
}

function _putenv(string) {
  if (string === 0) {
    ___setErrNo(28);
    return -1
  }
  string = UTF8ToString(string);
  var splitPoint = string.indexOf("=");
  if (string === "" || string.indexOf("=") === -1) {
    ___setErrNo(28);
    return -1
  }
  var name = string.slice(0, splitPoint);
  var value = string.slice(splitPoint + 1);
  if (!(name in ENV) || ENV[name] !== value) {
    ENV[name] = value;
    ___buildEnvironment(__get_environ())
  }
  return 0
}

function __isLeapYear(year) {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
}

function __arraySum(array, index) {
  var sum = 0;
  for (var i = 0; i <= index; sum += array[i++]);
  return sum
}
var __MONTH_DAYS_LEAP = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
var __MONTH_DAYS_REGULAR = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function __addDays(date, days) {
  var newDate = new Date(date.getTime());
  while (days > 0) {
    var leap = __isLeapYear(newDate.getFullYear());
    var currentMonth = newDate.getMonth();
    var daysInCurrentMonth = (leap ? __MONTH_DAYS_LEAP : __MONTH_DAYS_REGULAR)[currentMonth];
    if (days > daysInCurrentMonth - newDate.getDate()) {
      days -= daysInCurrentMonth - newDate.getDate() + 1;
      newDate.setDate(1);
      if (currentMonth < 11) {
        newDate.setMonth(currentMonth + 1)
      } else {
        newDate.setMonth(0);
        newDate.setFullYear(newDate.getFullYear() + 1)
      }
    } else {
      newDate.setDate(newDate.getDate() + days);
      return newDate
    }
  }
  return newDate
}

function _strftime(s, maxsize, format, tm) {
  var tm_zone = HEAP32[tm + 40 >> 2];
  var date = {
    tm_sec: HEAP32[tm >> 2],
    tm_min: HEAP32[tm + 4 >> 2],
    tm_hour: HEAP32[tm + 8 >> 2],
    tm_mday: HEAP32[tm + 12 >> 2],
    tm_mon: HEAP32[tm + 16 >> 2],
    tm_year: HEAP32[tm + 20 >> 2],
    tm_wday: HEAP32[tm + 24 >> 2],
    tm_yday: HEAP32[tm + 28 >> 2],
    tm_isdst: HEAP32[tm + 32 >> 2],
    tm_gmtoff: HEAP32[tm + 36 >> 2],
    tm_zone: tm_zone ? UTF8ToString(tm_zone) : ""
  };
  var pattern = UTF8ToString(format);
  var EXPANSION_RULES_1 = {
    "%c": "%a %b %d %H:%M:%S %Y",
    "%D": "%m/%d/%y",
    "%F": "%Y-%m-%d",
    "%h": "%b",
    "%r": "%I:%M:%S %p",
    "%R": "%H:%M",
    "%T": "%H:%M:%S",
    "%x": "%m/%d/%y",
    "%X": "%H:%M:%S",
    "%Ec": "%c",
    "%EC": "%C",
    "%Ex": "%m/%d/%y",
    "%EX": "%H:%M:%S",
    "%Ey": "%y",
    "%EY": "%Y",
    "%Od": "%d",
    "%Oe": "%e",
    "%OH": "%H",
    "%OI": "%I",
    "%Om": "%m",
    "%OM": "%M",
    "%OS": "%S",
    "%Ou": "%u",
    "%OU": "%U",
    "%OV": "%V",
    "%Ow": "%w",
    "%OW": "%W",
    "%Oy": "%y"
  };
  for (var rule in EXPANSION_RULES_1) {
    pattern = pattern.replace(new RegExp(rule, "g"), EXPANSION_RULES_1[rule])
  }
  var WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  var MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  function leadingSomething(value, digits, character) {
    var str = typeof value === "number" ? value.toString() : value || "";
    while (str.length < digits) {
      str = character[0] + str
    }
    return str
  }

  function leadingNulls(value, digits) {
    return leadingSomething(value, digits, "0")
  }

  function compareByDay(date1, date2) {
    function sgn(value) {
      return value < 0 ? -1 : value > 0 ? 1 : 0
    }
    var compare;
    if ((compare = sgn(date1.getFullYear() - date2.getFullYear())) === 0) {
      if ((compare = sgn(date1.getMonth() - date2.getMonth())) === 0) {
        compare = sgn(date1.getDate() - date2.getDate())
      }
    }
    return compare
  }

  function getFirstWeekStartDate(janFourth) {
    switch (janFourth.getDay()) {
      case 0:
        return new Date(janFourth.getFullYear() - 1, 11, 29);
      case 1:
        return janFourth;
      case 2:
        return new Date(janFourth.getFullYear(), 0, 3);
      case 3:
        return new Date(janFourth.getFullYear(), 0, 2);
      case 4:
        return new Date(janFourth.getFullYear(), 0, 1);
      case 5:
        return new Date(janFourth.getFullYear() - 1, 11, 31);
      case 6:
        return new Date(janFourth.getFullYear() - 1, 11, 30)
    }
  }

  function getWeekBasedYear(date) {
    var thisDate = __addDays(new Date(date.tm_year + 1900, 0, 1), date.tm_yday);
    var janFourthThisYear = new Date(thisDate.getFullYear(), 0, 4);
    var janFourthNextYear = new Date(thisDate.getFullYear() + 1, 0, 4);
    var firstWeekStartThisYear = getFirstWeekStartDate(janFourthThisYear);
    var firstWeekStartNextYear = getFirstWeekStartDate(janFourthNextYear);
    if (compareByDay(firstWeekStartThisYear, thisDate) <= 0) {
      if (compareByDay(firstWeekStartNextYear, thisDate) <= 0) {
        return thisDate.getFullYear() + 1
      } else {
        return thisDate.getFullYear()
      }
    } else {
      return thisDate.getFullYear() - 1
    }
  }
  var EXPANSION_RULES_2 = {
    "%a": function (date) {
      return WEEKDAYS[date.tm_wday].substring(0, 3)
    },
    "%A": function (date) {
      return WEEKDAYS[date.tm_wday]
    },
    "%b": function (date) {
      return MONTHS[date.tm_mon].substring(0, 3)
    },
    "%B": function (date) {
      return MONTHS[date.tm_mon]
    },
    "%C": function (date) {
      var year = date.tm_year + 1900;
      return leadingNulls(year / 100 | 0, 2)
    },
    "%d": function (date) {
      return leadingNulls(date.tm_mday, 2)
    },
    "%e": function (date) {
      return leadingSomething(date.tm_mday, 2, " ")
    },
    "%g": function (date) {
      return getWeekBasedYear(date).toString().substring(2)
    },
    "%G": function (date) {
      return getWeekBasedYear(date)
    },
    "%H": function (date) {
      return leadingNulls(date.tm_hour, 2)
    },
    "%I": function (date) {
      var twelveHour = date.tm_hour;
      if (twelveHour == 0) twelveHour = 12;
      else if (twelveHour > 12) twelveHour -= 12;
      return leadingNulls(twelveHour, 2)
    },
    "%j": function (date) {
      return leadingNulls(date.tm_mday + __arraySum(__isLeapYear(date.tm_year + 1900) ? __MONTH_DAYS_LEAP : __MONTH_DAYS_REGULAR, date.tm_mon - 1), 3)
    },
    "%m": function (date) {
      return leadingNulls(date.tm_mon + 1, 2)
    },
    "%M": function (date) {
      return leadingNulls(date.tm_min, 2)
    },
    "%n": function () {
      return "\n"
    },
    "%p": function (date) {
      if (date.tm_hour >= 0 && date.tm_hour < 12) {
        return "AM"
      } else {
        return "PM"
      }
    },
    "%S": function (date) {
      return leadingNulls(date.tm_sec, 2)
    },
    "%t": function () {
      return "\t"
    },
    "%u": function (date) {
      return date.tm_wday || 7
    },
    "%U": function (date) {
      var janFirst = new Date(date.tm_year + 1900, 0, 1);
      var firstSunday = janFirst.getDay() === 0 ? janFirst : __addDays(janFirst, 7 - janFirst.getDay());
      var endDate = new Date(date.tm_year + 1900, date.tm_mon, date.tm_mday);
      if (compareByDay(firstSunday, endDate) < 0) {
        var februaryFirstUntilEndMonth = __arraySum(__isLeapYear(endDate.getFullYear()) ? __MONTH_DAYS_LEAP : __MONTH_DAYS_REGULAR, endDate.getMonth() - 1) - 31;
        var firstSundayUntilEndJanuary = 31 - firstSunday.getDate();
        var days = firstSundayUntilEndJanuary + februaryFirstUntilEndMonth + endDate.getDate();
        return leadingNulls(Math.ceil(days / 7), 2)
      }
      return compareByDay(firstSunday, janFirst) === 0 ? "01" : "00"
    },
    "%V": function (date) {
      var janFourthThisYear = new Date(date.tm_year + 1900, 0, 4);
      var janFourthNextYear = new Date(date.tm_year + 1901, 0, 4);
      var firstWeekStartThisYear = getFirstWeekStartDate(janFourthThisYear);
      var firstWeekStartNextYear = getFirstWeekStartDate(janFourthNextYear);
      var endDate = __addDays(new Date(date.tm_year + 1900, 0, 1), date.tm_yday);
      if (compareByDay(endDate, firstWeekStartThisYear) < 0) {
        return "53"
      }
      if (compareByDay(firstWeekStartNextYear, endDate) <= 0) {
        return "01"
      }
      var daysDifference;
      if (firstWeekStartThisYear.getFullYear() < date.tm_year + 1900) {
        daysDifference = date.tm_yday + 32 - firstWeekStartThisYear.getDate()
      } else {
        daysDifference = date.tm_yday + 1 - firstWeekStartThisYear.getDate()
      }
      return leadingNulls(Math.ceil(daysDifference / 7), 2)
    },
    "%w": function (date) {
      return date.tm_wday
    },
    "%W": function (date) {
      var janFirst = new Date(date.tm_year, 0, 1);
      var firstMonday = janFirst.getDay() === 1 ? janFirst : __addDays(janFirst, janFirst.getDay() === 0 ? 1 : 7 - janFirst.getDay() + 1);
      var endDate = new Date(date.tm_year + 1900, date.tm_mon, date.tm_mday);
      if (compareByDay(firstMonday, endDate) < 0) {
        var februaryFirstUntilEndMonth = __arraySum(__isLeapYear(endDate.getFullYear()) ? __MONTH_DAYS_LEAP : __MONTH_DAYS_REGULAR, endDate.getMonth() - 1) - 31;
        var firstMondayUntilEndJanuary = 31 - firstMonday.getDate();
        var days = firstMondayUntilEndJanuary + februaryFirstUntilEndMonth + endDate.getDate();
        return leadingNulls(Math.ceil(days / 7), 2)
      }
      return compareByDay(firstMonday, janFirst) === 0 ? "01" : "00"
    },
    "%y": function (date) {
      return (date.tm_year + 1900).toString().substring(2)
    },
    "%Y": function (date) {
      return date.tm_year + 1900
    },
    "%z": function (date) {
      var off = date.tm_gmtoff;
      var ahead = off >= 0;
      off = Math.abs(off) / 60;
      off = off / 60 * 100 + off % 60;
      return (ahead ? "+" : "-") + String("0000" + off).slice(-4)
    },
    "%Z": function (date) {
      return date.tm_zone
    },
    "%%": function () {
      return "%"
    }
  };
  for (var rule in EXPANSION_RULES_2) {
    if (pattern.indexOf(rule) >= 0) {
      pattern = pattern.replace(new RegExp(rule, "g"), EXPANSION_RULES_2[rule](date))
    }
  }
  var bytes = intArrayFromString(pattern, false);
  if (bytes.length > maxsize) {
    return 0
  }
  writeArrayToMemory(bytes, s);
  return bytes.length - 1
}

function _strftime_l(s, maxsize, format, tm) {
  return _strftime(s, maxsize, format, tm)
}

function _time(ptr) {
  var ret = Date.now() / 1e3 | 0;
  if (ptr) {
    HEAP32[ptr >> 2] = ret
  }
  return ret
}
Module["requestFullScreen"] = function Module_requestFullScreen(lockPointer, resizeCanvas, vrDevice) {
  err("Module.requestFullScreen is deprecated. Please call Module.requestFullscreen instead.");
  Module["requestFullScreen"] = Module["requestFullscreen"];
  Browser.requestFullScreen(lockPointer, resizeCanvas, vrDevice)
};
Module["requestFullscreen"] = function Module_requestFullscreen(lockPointer, resizeCanvas, vrDevice) {
  Browser.requestFullscreen(lockPointer, resizeCanvas, vrDevice)
};
Module["requestAnimationFrame"] = function Module_requestAnimationFrame(func) {
  Browser.requestAnimationFrame(func)
};
Module["setCanvasSize"] = function Module_setCanvasSize(width, height, noUpdates) {
  Browser.setCanvasSize(width, height, noUpdates)
};
Module["pauseMainLoop"] = function Module_pauseMainLoop() {
  Browser.mainLoop.pause()
};
Module["resumeMainLoop"] = function Module_resumeMainLoop() {
  Browser.mainLoop.resume()
};
Module["getUserMedia"] = function Module_getUserMedia() {
  Browser.getUserMedia()
};
Module["createContext"] = function Module_createContext(canvas, useWebGL, setInModule, webGLContextAttributes) {
  return Browser.createContext(canvas, useWebGL, setInModule, webGLContextAttributes)
};
if (ENVIRONMENT_IS_NODE) {
  _emscripten_get_now = function _emscripten_get_now_actual() {
    var t = process["hrtime"]();
    return t[0] * 1e3 + t[1] / 1e6
  }
} else if (typeof dateNow !== "undefined") {
  _emscripten_get_now = dateNow
} else if (typeof performance === "object" && performance && typeof performance["now"] === "function") {
  _emscripten_get_now = function () {
    return performance["now"]()
  }
} else {
  _emscripten_get_now = Date.now
}
FS.staticInit();
Module["FS_createFolder"] = FS.createFolder;
Module["FS_createPath"] = FS.createPath;
Module["FS_createDataFile"] = FS.createDataFile;
Module["FS_createPreloadedFile"] = FS.createPreloadedFile;
Module["FS_createLazyFile"] = FS.createLazyFile;
Module["FS_createLink"] = FS.createLink;
Module["FS_createDevice"] = FS.createDevice;
Module["FS_unlink"] = FS.unlink;
if (ENVIRONMENT_HAS_NODE) {
  var fs = require("fs");
  var NODEJS_PATH = require("path");
  NODEFS.staticInit()
}
var GLctx;
GL.init();

function intArrayFromString(stringy, dontAddNull, length) {
  var len = length > 0 ? length : lengthBytesUTF8(stringy) + 1;
  var u8array = new Array(len);
  var numBytesWritten = stringToUTF8Array(stringy, u8array, 0, u8array.length);
  if (dontAddNull) u8array.length = numBytesWritten;
  return u8array
}
var asmGlobalArg = {};
var asmLibraryArg = {
  "b": EMTSTACKTOP,
  "eb": _SDL_CloseAudio,
  "db": _SDL_CreateRGBSurface,
  "ba": _SDL_Delay,
  "L": _SDL_FillRect,
  "K": _SDL_Flip,
  "cb": _SDL_FreeSurface,
  "u": _SDL_GetError,
  "bb": _SDL_GetKeyName,
  "J": _SDL_GetModState,
  "o": _SDL_GetTicks,
  "ab": _SDL_GetVideoInfo,
  "$a": _SDL_Init,
  "aa": _SDL_InitSubSystem,
  "I": _SDL_JoystickClose,
  "$": _SDL_JoystickEventState,
  "_a": _SDL_JoystickGetAxis,
  "Za": _SDL_JoystickGetButton,
  "Ya": _SDL_JoystickGetHat,
  "_": _SDL_JoystickName,
  "A": _SDL_JoystickNumAxes,
  "z": _SDL_JoystickNumButtons,
  "Xa": _SDL_JoystickNumHats,
  "y": _SDL_JoystickOpen,
  "Wa": _SDL_JoystickUpdate,
  "H": _SDL_LockAudio,
  "Z": _SDL_LockSurface,
  "G": _SDL_MapRGB,
  "Y": _SDL_NumJoysticks,
  "Va": _SDL_OpenAudio,
  "Ua": _SDL_PauseAudio,
  "F": _SDL_PollEvent,
  "X": _SDL_Quit,
  "Ta": _SDL_SetAlpha,
  "E": _SDL_SetPalette,
  "Sa": _SDL_SetVideoMode,
  "t": _SDL_ShowCursor,
  "x": _SDL_UnlockAudio,
  "W": _SDL_UnlockSurface,
  "V": _SDL_UpperBlit,
  "Ra": _SDL_VideoModeOK,
  "D": _SDL_WM_GrabInput,
  "Qa": _SDL_WM_SetCaption,
  "Pa": _SDL_WaitEvent,
  "U": ___assert_fail,
  "Oa": ___buildEnvironment,
  "h": ___cxa_allocate_exception,
  "g": ___cxa_throw,
  "T": ___lock,
  "Na": ___map_file,
  "S": ___syscall10,
  "Ma": ___syscall15,
  "La": ___syscall183,
  "Ka": ___syscall194,
  "R": ___syscall195,
  "Ja": ___syscall197,
  "Ia": ___syscall20,
  "Ha": ___syscall220,
  "q": ___syscall221,
  "Ga": ___syscall33,
  "Fa": ___syscall38,
  "Ea": ___syscall39,
  "Da": ___syscall4,
  "Q": ___syscall40,
  "P": ___syscall5,
  "Ca": ___syscall54,
  "Ba": ___syscall60,
  "Aa": ___syscall91,
  "s": ___unlock,
  "w": ___wasi_fd_close,
  "za": ___wasi_fd_read,
  "ya": ___wasi_fd_seek,
  "xa": ___wasi_fd_write,
  "__memory_base": 1024,
  "__table_base": 0,
  "e": _abort,
  "wa": _clock_gettime,
  "l": _emscripten_asm_const_i,
  "C": _emscripten_asm_const_ii,
  "B": _emscripten_asm_const_iii,
  "O": _emscripten_cancel_main_loop,
  "va": _emscripten_exit_pointerlock,
  "ua": _emscripten_fetch,
  "ta": _emscripten_fetch_attr_init,
  "sa": _emscripten_fetch_close,
  "N": _emscripten_force_exit,
  "ra": _emscripten_get_heap_size,
  "qa": _emscripten_get_pointerlock_status,
  "pa": _emscripten_memcpy_big,
  "oa": _emscripten_request_pointerlock,
  "na": _emscripten_resize_heap,
  "ma": _emscripten_set_main_loop,
  "la": _emscripten_set_mousedown_callback_on_thread,
  "ka": _emscripten_set_pointerlockchange_callback_on_thread,
  "ja": _emscripten_sleep,
  "ia": _emscripten_sleep_with_yield,
  "M": _execlp,
  "ha": _execvp,
  "k": _exit,
  "r": _getenv,
  "ga": _getpwnam,
  "i": _llvm_exp2_f64,
  "n": _llvm_stackrestore,
  "m": _llvm_stacksave,
  "fa": _llvm_trap,
  "p": _localtime,
  "ea": _mktime,
  "da": _putenv,
  "ca": _strftime_l,
  "v": _time,
  "j": abort,
  "c": eb,
  "d": getTempRet0,
  "memory": wasmMemory,
  "f": setTempRet0,
  "table": wasmTable,
  "a": tempDoublePtr
};
var asm = Module["asm"](asmGlobalArg, asmLibraryArg, buffer);
Module["asm"] = asm;
var __GLOBAL__sub_I_cpu_cpp = Module["__GLOBAL__sub_I_cpu_cpp"] = function () {
  return Module["asm"]["fb"].apply(null, arguments)
};
var __GLOBAL__sub_I_drives_cpp = Module["__GLOBAL__sub_I_drives_cpp"] = function () {
  return Module["asm"]["gb"].apply(null, arguments)
};
var __GLOBAL__sub_I_hardware_cpp = Module["__GLOBAL__sub_I_hardware_cpp"] = function () {
  return Module["asm"]["hb"].apply(null, arguments)
};
var __GLOBAL__sub_I_js_dos_asyncify_cpp = Module["__GLOBAL__sub_I_js_dos_asyncify_cpp"] = function () {
  return Module["asm"]["ib"].apply(null, arguments)
};
var __GLOBAL__sub_I_programs_cpp = Module["__GLOBAL__sub_I_programs_cpp"] = function () {
  return Module["asm"]["jb"].apply(null, arguments)
};
var __GLOBAL__sub_I_sdl_mapper_cpp = Module["__GLOBAL__sub_I_sdl_mapper_cpp"] = function () {
  return Module["asm"]["kb"].apply(null, arguments)
};
var __GLOBAL__sub_I_setup_cpp = Module["__GLOBAL__sub_I_setup_cpp"] = function () {
  return Module["asm"]["lb"].apply(null, arguments)
};
var __GLOBAL__sub_I_shell_misc_cpp = Module["__GLOBAL__sub_I_shell_misc_cpp"] = function () {
  return Module["asm"]["mb"].apply(null, arguments)
};
var __ZSt18uncaught_exceptionv = Module["__ZSt18uncaught_exceptionv"] = function () {
  return Module["asm"]["nb"].apply(null, arguments)
};
var ___em_js__syncSleep = Module["___em_js__syncSleep"] = function () {
  return Module["asm"]["ob"].apply(null, arguments)
};
var ___emscripten_environ_constructor = Module["___emscripten_environ_constructor"] = function () {
  return Module["asm"]["pb"].apply(null, arguments)
};
var ___errno_location = Module["___errno_location"] = function () {
  return Module["asm"]["qb"].apply(null, arguments)
};
var __get_daylight = Module["__get_daylight"] = function () {
  return Module["asm"]["rb"].apply(null, arguments)
};
var __get_environ = Module["__get_environ"] = function () {
  return Module["asm"]["sb"].apply(null, arguments)
};
var __get_timezone = Module["__get_timezone"] = function () {
  return Module["asm"]["tb"].apply(null, arguments)
};
var __get_tzname = Module["__get_tzname"] = function () {
  return Module["asm"]["ub"].apply(null, arguments)
};
var __send = Module["__send"] = function () {
  return Module["asm"]["vb"].apply(null, arguments)
};
var _extract_zip = Module["_extract_zip"] = function () {
  return Module["asm"]["wb"].apply(null, arguments)
};
var _free = Module["_free"] = function () {
  return Module["asm"]["xb"].apply(null, arguments)
};
var _main = Module["_main"] = function () {
  return Module["asm"]["yb"].apply(null, arguments)
};
var _malloc = Module["_malloc"] = function () {
  return Module["asm"]["zb"].apply(null, arguments)
};
var _memcpy = Module["_memcpy"] = function () {
  return Module["asm"]["Ab"].apply(null, arguments)
};
var _memset = Module["_memset"] = function () {
  return Module["asm"]["Bb"].apply(null, arguments)
};
var _safe_create_dir = Module["_safe_create_dir"] = function () {
  return Module["asm"]["Cb"].apply(null, arguments)
};
var emtStackRestore = Module["emtStackRestore"] = function () {
  return Module["asm"]["Ib"].apply(null, arguments)
};
var emtStackSave = Module["emtStackSave"] = function () {
  return Module["asm"]["Jb"].apply(null, arguments)
};
var emterpret = Module["emterpret"] = function () {
  return Module["asm"]["Kb"].apply(null, arguments)
};
var setAsyncState = Module["setAsyncState"] = function () {
  return Module["asm"]["Lb"].apply(null, arguments)
};
var stackAlloc = Module["stackAlloc"] = function () {
  return Module["asm"]["Mb"].apply(null, arguments)
};
var stackRestore = Module["stackRestore"] = function () {
  return Module["asm"]["Nb"].apply(null, arguments)
};
var stackSave = Module["stackSave"] = function () {
  return Module["asm"]["Ob"].apply(null, arguments)
};
var dynCall_iii = Module["dynCall_iii"] = function () {
  return Module["asm"]["Db"].apply(null, arguments)
};
var dynCall_iiii = Module["dynCall_iiii"] = function () {
  return Module["asm"]["Eb"].apply(null, arguments)
};
var dynCall_v = Module["dynCall_v"] = function () {
  return Module["asm"]["Fb"].apply(null, arguments)
};
var dynCall_vi = Module["dynCall_vi"] = function () {
  return Module["asm"]["Gb"].apply(null, arguments)
};
var dynCall_viii = Module["dynCall_viii"] = function () {
  return Module["asm"]["Hb"].apply(null, arguments)
};
if (ENVIRONMENT_IS_WORKER) {
  function WebGLBuffer(id) {
    this.what = "buffer";
    this.id = id
  }

  function WebGLProgram(id) {
    this.what = "program";
    this.id = id;
    this.shaders = [];
    this.attributes = {};
    this.attributeVec = [];
    this.nextAttributes = {};
    this.nextAttributeVec = []
  }

  function WebGLFramebuffer(id) {
    this.what = "frameBuffer";
    this.id = id
  }

  function WebGLRenderbuffer(id) {
    this.what = "renderBuffer";
    this.id = id
  }

  function WebGLTexture(id) {
    this.what = "texture";
    this.id = id;
    this.binding = 0
  }

  function WebGLWorker() {
    this.DEPTH_BUFFER_BIT = 256;
    this.STENCIL_BUFFER_BIT = 1024;
    this.COLOR_BUFFER_BIT = 16384;
    this.POINTS = 0;
    this.LINES = 1;
    this.LINE_LOOP = 2;
    this.LINE_STRIP = 3;
    this.TRIANGLES = 4;
    this.TRIANGLE_STRIP = 5;
    this.TRIANGLE_FAN = 6;
    this.ZERO = 0;
    this.ONE = 1;
    this.SRC_COLOR = 768;
    this.ONE_MINUS_SRC_COLOR = 769;
    this.SRC_ALPHA = 770;
    this.ONE_MINUS_SRC_ALPHA = 771;
    this.DST_ALPHA = 772;
    this.ONE_MINUS_DST_ALPHA = 773;
    this.DST_COLOR = 774;
    this.ONE_MINUS_DST_COLOR = 775;
    this.SRC_ALPHA_SATURATE = 776;
    this.FUNC_ADD = 32774;
    this.BLEND_EQUATION = 32777;
    this.BLEND_EQUATION_RGB = 32777;
    this.BLEND_EQUATION_ALPHA = 34877;
    this.FUNC_SUBTRACT = 32778;
    this.FUNC_REVERSE_SUBTRACT = 32779;
    this.BLEND_DST_RGB = 32968;
    this.BLEND_SRC_RGB = 32969;
    this.BLEND_DST_ALPHA = 32970;
    this.BLEND_SRC_ALPHA = 32971;
    this.CONSTANT_COLOR = 32769;
    this.ONE_MINUS_CONSTANT_COLOR = 32770;
    this.CONSTANT_ALPHA = 32771;
    this.ONE_MINUS_CONSTANT_ALPHA = 32772;
    this.BLEND_COLOR = 32773;
    this.ARRAY_BUFFER = 34962;
    this.ELEMENT_ARRAY_BUFFER = 34963;
    this.ARRAY_BUFFER_BINDING = 34964;
    this.ELEMENT_ARRAY_BUFFER_BINDING = 34965;
    this.STREAM_DRAW = 35040;
    this.STATIC_DRAW = 35044;
    this.DYNAMIC_DRAW = 35048;
    this.BUFFER_SIZE = 34660;
    this.BUFFER_USAGE = 34661;
    this.CURRENT_VERTEX_ATTRIB = 34342;
    this.FRONT = 1028;
    this.BACK = 1029;
    this.FRONT_AND_BACK = 1032;
    this.CULL_FACE = 2884;
    this.BLEND = 3042;
    this.DITHER = 3024;
    this.STENCIL_TEST = 2960;
    this.DEPTH_TEST = 2929;
    this.SCISSOR_TEST = 3089;
    this.POLYGON_OFFSET_FILL = 32823;
    this.SAMPLE_ALPHA_TO_COVERAGE = 32926;
    this.SAMPLE_COVERAGE = 32928;
    this.NO_ERROR = 0;
    this.INVALID_ENUM = 1280;
    this.INVALID_VALUE = 1281;
    this.INVALID_OPERATION = 1282;
    this.OUT_OF_MEMORY = 1285;
    this.CW = 2304;
    this.CCW = 2305;
    this.LINE_WIDTH = 2849;
    this.ALIASED_POINT_SIZE_RANGE = 33901;
    this.ALIASED_LINE_WIDTH_RANGE = 33902;
    this.CULL_FACE_MODE = 2885;
    this.FRONT_FACE = 2886;
    this.DEPTH_RANGE = 2928;
    this.DEPTH_WRITEMASK = 2930;
    this.DEPTH_CLEAR_VALUE = 2931;
    this.DEPTH_FUNC = 2932;
    this.STENCIL_CLEAR_VALUE = 2961;
    this.STENCIL_FUNC = 2962;
    this.STENCIL_FAIL = 2964;
    this.STENCIL_PASS_DEPTH_FAIL = 2965;
    this.STENCIL_PASS_DEPTH_PASS = 2966;
    this.STENCIL_REF = 2967;
    this.STENCIL_VALUE_MASK = 2963;
    this.STENCIL_WRITEMASK = 2968;
    this.STENCIL_BACK_FUNC = 34816;
    this.STENCIL_BACK_FAIL = 34817;
    this.STENCIL_BACK_PASS_DEPTH_FAIL = 34818;
    this.STENCIL_BACK_PASS_DEPTH_PASS = 34819;
    this.STENCIL_BACK_REF = 36003;
    this.STENCIL_BACK_VALUE_MASK = 36004;
    this.STENCIL_BACK_WRITEMASK = 36005;
    this.VIEWPORT = 2978;
    this.SCISSOR_BOX = 3088;
    this.COLOR_CLEAR_VALUE = 3106;
    this.COLOR_WRITEMASK = 3107;
    this.UNPACK_ALIGNMENT = 3317;
    this.PACK_ALIGNMENT = 3333;
    this.MAX_TEXTURE_SIZE = 3379;
    this.MAX_VIEWPORT_DIMS = 3386;
    this.SUBPIXEL_BITS = 3408;
    this.RED_BITS = 3410;
    this.GREEN_BITS = 3411;
    this.BLUE_BITS = 3412;
    this.ALPHA_BITS = 3413;
    this.DEPTH_BITS = 3414;
    this.STENCIL_BITS = 3415;
    this.POLYGON_OFFSET_UNITS = 10752;
    this.POLYGON_OFFSET_FACTOR = 32824;
    this.TEXTURE_BINDING_2D = 32873;
    this.SAMPLE_BUFFERS = 32936;
    this.SAMPLES = 32937;
    this.SAMPLE_COVERAGE_VALUE = 32938;
    this.SAMPLE_COVERAGE_INVERT = 32939;
    this.COMPRESSED_TEXTURE_FORMATS = 34467;
    this.DONT_CARE = 4352;
    this.FASTEST = 4353;
    this.NICEST = 4354;
    this.GENERATE_MIPMAP_HINT = 33170;
    this.BYTE = 5120;
    this.UNSIGNED_BYTE = 5121;
    this.SHORT = 5122;
    this.UNSIGNED_SHORT = 5123;
    this.INT = 5124;
    this.UNSIGNED_INT = 5125;
    this.FLOAT = 5126;
    this.DEPTH_COMPONENT = 6402;
    this.ALPHA = 6406;
    this.RGB = 6407;
    this.RGBA = 6408;
    this.LUMINANCE = 6409;
    this.LUMINANCE_ALPHA = 6410;
    this.UNSIGNED_SHORT_4_4_4_4 = 32819;
    this.UNSIGNED_SHORT_5_5_5_1 = 32820;
    this.UNSIGNED_SHORT_5_6_5 = 33635;
    this.FRAGMENT_SHADER = 35632;
    this.VERTEX_SHADER = 35633;
    this.MAX_VERTEX_ATTRIBS = 34921;
    this.MAX_VERTEX_UNIFORM_VECTORS = 36347;
    this.MAX_VARYING_VECTORS = 36348;
    this.MAX_COMBINED_TEXTURE_IMAGE_UNITS = 35661;
    this.MAX_VERTEX_TEXTURE_IMAGE_UNITS = 35660;
    this.MAX_TEXTURE_IMAGE_UNITS = 34930;
    this.MAX_FRAGMENT_UNIFORM_VECTORS = 36349;
    this.SHADER_TYPE = 35663;
    this.DELETE_STATUS = 35712;
    this.LINK_STATUS = 35714;
    this.VALIDATE_STATUS = 35715;
    this.ATTACHED_SHADERS = 35717;
    this.ACTIVE_UNIFORMS = 35718;
    this.ACTIVE_ATTRIBUTES = 35721;
    this.SHADING_LANGUAGE_VERSION = 35724;
    this.CURRENT_PROGRAM = 35725;
    this.NEVER = 512;
    this.LESS = 513;
    this.EQUAL = 514;
    this.LEQUAL = 515;
    this.GREATER = 516;
    this.NOTEQUAL = 517;
    this.GEQUAL = 518;
    this.ALWAYS = 519;
    this.KEEP = 7680;
    this.REPLACE = 7681;
    this.INCR = 7682;
    this.DECR = 7683;
    this.INVERT = 5386;
    this.INCR_WRAP = 34055;
    this.DECR_WRAP = 34056;
    this.VENDOR = 7936;
    this.RENDERER = 7937;
    this.VERSION = 7938;
    this.NEAREST = 9728;
    this.LINEAR = 9729;
    this.NEAREST_MIPMAP_NEAREST = 9984;
    this.LINEAR_MIPMAP_NEAREST = 9985;
    this.NEAREST_MIPMAP_LINEAR = 9986;
    this.LINEAR_MIPMAP_LINEAR = 9987;
    this.TEXTURE_MAG_FILTER = 10240;
    this.TEXTURE_MIN_FILTER = 10241;
    this.TEXTURE_WRAP_S = 10242;
    this.TEXTURE_WRAP_T = 10243;
    this.TEXTURE_2D = 3553;
    this.TEXTURE = 5890;
    this.TEXTURE_CUBE_MAP = 34067;
    this.TEXTURE_BINDING_CUBE_MAP = 34068;
    this.TEXTURE_CUBE_MAP_POSITIVE_X = 34069;
    this.TEXTURE_CUBE_MAP_NEGATIVE_X = 34070;
    this.TEXTURE_CUBE_MAP_POSITIVE_Y = 34071;
    this.TEXTURE_CUBE_MAP_NEGATIVE_Y = 34072;
    this.TEXTURE_CUBE_MAP_POSITIVE_Z = 34073;
    this.TEXTURE_CUBE_MAP_NEGATIVE_Z = 34074;
    this.MAX_CUBE_MAP_TEXTURE_SIZE = 34076;
    this.TEXTURE0 = 33984;
    this.TEXTURE1 = 33985;
    this.TEXTURE2 = 33986;
    this.TEXTURE3 = 33987;
    this.TEXTURE4 = 33988;
    this.TEXTURE5 = 33989;
    this.TEXTURE6 = 33990;
    this.TEXTURE7 = 33991;
    this.TEXTURE8 = 33992;
    this.TEXTURE9 = 33993;
    this.TEXTURE10 = 33994;
    this.TEXTURE11 = 33995;
    this.TEXTURE12 = 33996;
    this.TEXTURE13 = 33997;
    this.TEXTURE14 = 33998;
    this.TEXTURE15 = 33999;
    this.TEXTURE16 = 34e3;
    this.TEXTURE17 = 34001;
    this.TEXTURE18 = 34002;
    this.TEXTURE19 = 34003;
    this.TEXTURE20 = 34004;
    this.TEXTURE21 = 34005;
    this.TEXTURE22 = 34006;
    this.TEXTURE23 = 34007;
    this.TEXTURE24 = 34008;
    this.TEXTURE25 = 34009;
    this.TEXTURE26 = 34010;
    this.TEXTURE27 = 34011;
    this.TEXTURE28 = 34012;
    this.TEXTURE29 = 34013;
    this.TEXTURE30 = 34014;
    this.TEXTURE31 = 34015;
    this.ACTIVE_TEXTURE = 34016;
    this.REPEAT = 10497;
    this.CLAMP_TO_EDGE = 33071;
    this.MIRRORED_REPEAT = 33648;
    this.FLOAT_VEC2 = 35664;
    this.FLOAT_VEC3 = 35665;
    this.FLOAT_VEC4 = 35666;
    this.INT_VEC2 = 35667;
    this.INT_VEC3 = 35668;
    this.INT_VEC4 = 35669;
    this.BOOL = 35670;
    this.BOOL_VEC2 = 35671;
    this.BOOL_VEC3 = 35672;
    this.BOOL_VEC4 = 35673;
    this.FLOAT_MAT2 = 35674;
    this.FLOAT_MAT3 = 35675;
    this.FLOAT_MAT4 = 35676;
    this.SAMPLER_2D = 35678;
    this.SAMPLER_3D = 35679;
    this.SAMPLER_CUBE = 35680;
    this.VERTEX_ATTRIB_ARRAY_ENABLED = 34338;
    this.VERTEX_ATTRIB_ARRAY_SIZE = 34339;
    this.VERTEX_ATTRIB_ARRAY_STRIDE = 34340;
    this.VERTEX_ATTRIB_ARRAY_TYPE = 34341;
    this.VERTEX_ATTRIB_ARRAY_NORMALIZED = 34922;
    this.VERTEX_ATTRIB_ARRAY_POINTER = 34373;
    this.VERTEX_ATTRIB_ARRAY_BUFFER_BINDING = 34975;
    this.IMPLEMENTATION_COLOR_READ_TYPE = 35738;
    this.IMPLEMENTATION_COLOR_READ_FORMAT = 35739;
    this.COMPILE_STATUS = 35713;
    this.LOW_FLOAT = 36336;
    this.MEDIUM_FLOAT = 36337;
    this.HIGH_FLOAT = 36338;
    this.LOW_INT = 36339;
    this.MEDIUM_INT = 36340;
    this.HIGH_INT = 36341;
    this.FRAMEBUFFER = 36160;
    this.RENDERBUFFER = 36161;
    this.RGBA4 = 32854;
    this.RGB5_A1 = 32855;
    this.RGB565 = 36194;
    this.DEPTH_COMPONENT16 = 33189;
    this.STENCIL_INDEX = 6401;
    this.STENCIL_INDEX8 = 36168;
    this.DEPTH_STENCIL = 34041;
    this.RENDERBUFFER_WIDTH = 36162;
    this.RENDERBUFFER_HEIGHT = 36163;
    this.RENDERBUFFER_INTERNAL_FORMAT = 36164;
    this.RENDERBUFFER_RED_SIZE = 36176;
    this.RENDERBUFFER_GREEN_SIZE = 36177;
    this.RENDERBUFFER_BLUE_SIZE = 36178;
    this.RENDERBUFFER_ALPHA_SIZE = 36179;
    this.RENDERBUFFER_DEPTH_SIZE = 36180;
    this.RENDERBUFFER_STENCIL_SIZE = 36181;
    this.FRAMEBUFFER_ATTACHMENT_OBJECT_TYPE = 36048;
    this.FRAMEBUFFER_ATTACHMENT_OBJECT_NAME = 36049;
    this.FRAMEBUFFER_ATTACHMENT_TEXTURE_LEVEL = 36050;
    this.FRAMEBUFFER_ATTACHMENT_TEXTURE_CUBE_MAP_FACE = 36051;
    this.COLOR_ATTACHMENT0 = 36064;
    this.DEPTH_ATTACHMENT = 36096;
    this.STENCIL_ATTACHMENT = 36128;
    this.DEPTH_STENCIL_ATTACHMENT = 33306;
    this.NONE = 0;
    this.FRAMEBUFFER_COMPLETE = 36053;
    this.FRAMEBUFFER_INCOMPLETE_ATTACHMENT = 36054;
    this.FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT = 36055;
    this.FRAMEBUFFER_INCOMPLETE_DIMENSIONS = 36057;
    this.FRAMEBUFFER_UNSUPPORTED = 36061;
    this.ACTIVE_TEXTURE = 34016;
    this.FRAMEBUFFER_BINDING = 36006;
    this.RENDERBUFFER_BINDING = 36007;
    this.MAX_RENDERBUFFER_SIZE = 34024;
    this.INVALID_FRAMEBUFFER_OPERATION = 1286;
    this.UNPACK_FLIP_Y_WEBGL = 37440;
    this.UNPACK_PREMULTIPLY_ALPHA_WEBGL = 37441;
    this.CONTEXT_LOST_WEBGL = 37442;
    this.UNPACK_COLORSPACE_CONVERSION_WEBGL = 37443;
    this.BROWSER_DEFAULT_WEBGL = 37444;
    var commandBuffer = [];
    var nextId = 1;
    var bindings = {
      texture2D: null,
      arrayBuffer: null,
      elementArrayBuffer: null,
      program: null,
      framebuffer: null,
      activeTexture: this.TEXTURE0,
      generateMipmapHint: this.DONT_CARE,
      blendSrcRGB: this.ONE,
      blendSrcAlpha: this.ONE,
      blendDstRGB: this.ZERO,
      blendDstAlpha: this.ZERO,
      blendEquationRGB: this.FUNC_ADD,
      blendEquationAlpha: this.FUNC_ADD,
      enabledState: {}
    };
    var stateDisabledByDefault = [this.BLEND, this.CULL_FACE, this.DEPTH_TEST, this.DITHER, this.POLYGON_OFFSET_FILL, this.SAMPLE_ALPHA_TO_COVERAGE, this.SAMPLE_COVERAGE, this.SCISSOR_TEST, this.STENCIL_TEST];
    for (var i in stateDisabledByDefault) {
      bindings.enabledState[stateDisabledByDefault[i]] = false
    }
    var that = this;
    this.onmessage = function (msg) {
      switch (msg.op) {
        case "setPrefetched": {
          WebGLWorker.prototype.prefetchedParameters = msg.parameters;
          WebGLWorker.prototype.prefetchedExtensions = msg.extensions;
          WebGLWorker.prototype.prefetchedPrecisions = msg.precisions;
          removeRunDependency("gl-prefetch");
          break
        }
        default:
          throw "weird gl onmessage " + JSON.stringify(msg)
      }
    };

    function revname(name) {
      for (var x in that)
        if (that[x] === name) return x;
      return null
    }
    this.getParameter = function (name) {
      assert(name);
      if (name in this.prefetchedParameters) return this.prefetchedParameters[name];
      switch (name) {
        case this.TEXTURE_BINDING_2D: {
          return bindings.texture2D
        }
        case this.ARRAY_BUFFER_BINDING: {
          return bindings.arrayBuffer
        }
        case this.ELEMENT_ARRAY_BUFFER_BINDING: {
          return bindings.elementArrayBuffer
        }
        case this.CURRENT_PROGRAM: {
          return bindings.program
        }
        case this.FRAMEBUFFER_BINDING: {
          return bindings.framebuffer
        }
        case this.ACTIVE_TEXTURE: {
          return bindings.activeTexture
        }
        case this.GENERATE_MIPMAP_HINT: {
          return bindings.generateMipmapHint
        }
        case this.BLEND_SRC_RGB: {
          return bindings.blendSrcRGB
        }
        case this.BLEND_SRC_ALPHA: {
          return bindings.blendSrcAlpha
        }
        case this.BLEND_DST_RGB: {
          return bindings.blendDstRGB
        }
        case this.BLEND_DST_ALPHA: {
          return bindings.blendDstAlpha
        }
        case this.BLEND_EQUATION_RGB: {
          return bindings.blendEquationRGB
        }
        case this.BLEND_EQUATION_ALPHA: {
          return bindings.blendEquationAlpha
        }
        default: {
          if (bindings.enabledState[name] !== undefined) return bindings.enabledState[name];
          throw "TODO: get parameter " + name + " : " + revname(name)
        }
      }
    };
    this.getExtension = function (name) {
      var i = this.prefetchedExtensions.indexOf(name);
      if (i < 0) return null;
      commandBuffer.push(1, name);
      switch (name) {
        case "EXT_texture_filter_anisotropic": {
          return {
            TEXTURE_MAX_ANISOTROPY_EXT: 34046,
            MAX_TEXTURE_MAX_ANISOTROPY_EXT: 34047
          }
        }
        case "WEBGL_draw_buffers": {
          return {
            COLOR_ATTACHMENT0_WEBGL: 36064,
            COLOR_ATTACHMENT1_WEBGL: 36065,
            COLOR_ATTACHMENT2_WEBGL: 36066,
            COLOR_ATTACHMENT3_WEBGL: 36067,
            COLOR_ATTACHMENT4_WEBGL: 36068,
            COLOR_ATTACHMENT5_WEBGL: 36069,
            COLOR_ATTACHMENT6_WEBGL: 36070,
            COLOR_ATTACHMENT7_WEBGL: 36071,
            COLOR_ATTACHMENT8_WEBGL: 36072,
            COLOR_ATTACHMENT9_WEBGL: 36073,
            COLOR_ATTACHMENT10_WEBGL: 36074,
            COLOR_ATTACHMENT11_WEBGL: 36075,
            COLOR_ATTACHMENT12_WEBGL: 36076,
            COLOR_ATTACHMENT13_WEBGL: 36077,
            COLOR_ATTACHMENT14_WEBGL: 36078,
            COLOR_ATTACHMENT15_WEBGL: 36079,
            DRAW_BUFFER0_WEBGL: 34853,
            DRAW_BUFFER1_WEBGL: 34854,
            DRAW_BUFFER2_WEBGL: 34855,
            DRAW_BUFFER3_WEBGL: 34856,
            DRAW_BUFFER4_WEBGL: 34857,
            DRAW_BUFFER5_WEBGL: 34858,
            DRAW_BUFFER6_WEBGL: 34859,
            DRAW_BUFFER7_WEBGL: 34860,
            DRAW_BUFFER8_WEBGL: 34861,
            DRAW_BUFFER9_WEBGL: 34862,
            DRAW_BUFFER10_WEBGL: 34863,
            DRAW_BUFFER11_WEBGL: 34864,
            DRAW_BUFFER12_WEBGL: 34865,
            DRAW_BUFFER13_WEBGL: 34866,
            DRAW_BUFFER14_WEBGL: 34867,
            DRAW_BUFFER15_WEBGL: 34868,
            MAX_COLOR_ATTACHMENTS_WEBGL: 36063,
            MAX_DRAW_BUFFERS_WEBGL: 34852,
            drawBuffersWEBGL: function (buffers) {
              that.drawBuffersWEBGL(buffers)
            }
          }
        }
        case "OES_standard_derivatives": {
          return {
            FRAGMENT_SHADER_DERIVATIVE_HINT_OES: 35723
          }
        }
      }
      return true
    };
    this.getSupportedExtensions = function () {
      return this.prefetchedExtensions
    };
    this.getShaderPrecisionFormat = function (shaderType, precisionType) {
      return this.prefetchedPrecisions[shaderType][precisionType]
    };
    this.enable = function (cap) {
      commandBuffer.push(2, cap);
      bindings.enabledState[cap] = true
    };
    this.isEnabled = function (cap) {
      return bindings.enabledState[cap]
    };
    this.disable = function (cap) {
      commandBuffer.push(3, cap);
      bindings.enabledState[cap] = false
    };
    this.clear = function (mask) {
      commandBuffer.push(4, mask)
    };
    this.clearColor = function (r, g, b, a) {
      commandBuffer.push(5, r, g, b, a)
    };
    this.createShader = function (type) {
      var id = nextId++;
      commandBuffer.push(6, type, id);
      return {
        id: id,
        what: "shader",
        type: type
      }
    };
    this.deleteShader = function (shader) {
      if (!shader) return;
      commandBuffer.push(7, shader.id)
    };
    this.shaderSource = function (shader, source) {
      shader.source = source;
      commandBuffer.push(8, shader.id, source)
    };
    this.compileShader = function (shader) {
      commandBuffer.push(9, shader.id)
    };
    this.getShaderInfoLog = function (shader) {
      return ""
    };
    this.createProgram = function () {
      var id = nextId++;
      commandBuffer.push(10, id);
      return new WebGLProgram(id)
    };
    this.deleteProgram = function (program) {
      if (!program) return;
      commandBuffer.push(11, program.id)
    };
    this.attachShader = function (program, shader) {
      program.shaders.push(shader);
      commandBuffer.push(12, program.id, shader.id)
    };
    this.bindAttribLocation = function (program, index, name) {
      program.nextAttributes[name] = {
        what: "attribute",
        name: name,
        size: -1,
        location: index,
        type: "?"
      };
      program.nextAttributeVec[index] = name;
      commandBuffer.push(13, program.id, index, name)
    };
    this.getAttribLocation = function (program, name) {
      if (name in program.attributes) return program.attributes[name].location;
      return -1
    };
    this.linkProgram = function (program) {
      function getTypeId(text) {
        switch (text) {
          case "bool":
            return that.BOOL;
          case "int":
            return that.INT;
          case "uint":
            return that.UNSIGNED_INT;
          case "float":
            return that.FLOAT;
          case "vec2":
            return that.FLOAT_VEC2;
          case "vec3":
            return that.FLOAT_VEC3;
          case "vec4":
            return that.FLOAT_VEC4;
          case "ivec2":
            return that.INT_VEC2;
          case "ivec3":
            return that.INT_VEC3;
          case "ivec4":
            return that.INT_VEC4;
          case "bvec2":
            return that.BOOL_VEC2;
          case "bvec3":
            return that.BOOL_VEC3;
          case "bvec4":
            return that.BOOL_VEC4;
          case "mat2":
            return that.FLOAT_MAT2;
          case "mat3":
            return that.FLOAT_MAT3;
          case "mat4":
            return that.FLOAT_MAT4;
          case "sampler2D":
            return that.SAMPLER_2D;
          case "sampler3D":
            return that.SAMPLER_3D;
          case "samplerCube":
            return that.SAMPLER_CUBE;
          default:
            throw "not yet recognized type text: " + text
        }
      }

      function parseElementType(shader, type, obj, vec) {
        var source = shader.source;
        source = source.replace(/\n/g, "|\n");
        var newItems = source.match(new RegExp(type + "\\s+\\w+\\s+[\\w,\\s[\\]]+;", "g"));
        if (!newItems) return;
        newItems.forEach(function (item) {
          var m = new RegExp(type + "\\s+(\\w+)\\s+([\\w,\\s[\\]]+);").exec(item);
          assert(m);
          m[2].split(",").map(function (name) {
            name = name.trim();
            return name.search(/\s/) >= 0 ? "" : name
          }).filter(function (name) {
            return !!name
          }).forEach(function (name) {
            var size = 1;
            var open = name.indexOf("[");
            var fullname = name;
            if (open >= 0) {
              var close = name.indexOf("]");
              size = parseInt(name.substring(open + 1, close));
              name = name.substr(0, open);
              fullname = name + "[0]"
            }
            if (!obj[name]) {
              obj[name] = {
                what: type,
                name: fullname,
                size: size,
                location: -1,
                type: getTypeId(m[1])
              };
              if (vec) vec.push(name)
            }
          })
        })
      }
      program.uniforms = {};
      program.uniformVec = [];
      program.attributes = program.nextAttributes;
      program.attributeVec = program.nextAttributeVec;
      program.nextAttributes = {};
      program.nextAttributeVec = [];
      var existingAttributes = {};
      program.shaders.forEach(function (shader) {
        parseElementType(shader, "uniform", program.uniforms, program.uniformVec);
        parseElementType(shader, "attribute", existingAttributes, null)
      });
      for (var attr in existingAttributes) {
        if (!(attr in program.attributes)) {
          var index = program.attributeVec.length;
          program.attributes[attr] = {
            what: "attribute",
            name: attr,
            size: -1,
            location: index,
            type: "?"
          };
          program.attributeVec[index] = attr;
          commandBuffer.push(13, program.id, index, attr)
        }
        program.attributes[attr].size = existingAttributes[attr].size;
        program.attributes[attr].type = existingAttributes[attr].type
      }
      commandBuffer.push(14, program.id)
    };
    this.getProgramParameter = function (program, name) {
      switch (name) {
        case this.ACTIVE_UNIFORMS:
          return program.uniformVec.length;
        case this.ACTIVE_ATTRIBUTES:
          return program.attributeVec.length;
        case this.LINK_STATUS: {
          commandBuffer.push(15, program.id, name);
          return true
        }
        default:
          throw "bad getProgramParameter " + revname(name)
      }
    };
    this.getActiveAttrib = function (program, index) {
      var name = program.attributeVec[index];
      if (!name) return null;
      return program.attributes[name]
    };
    this.getActiveUniform = function (program, index) {
      var name = program.uniformVec[index];
      if (!name) return null;
      return program.uniforms[name]
    };
    this.getUniformLocation = function (program, name) {
      var fullname = name;
      var index = -1;
      var open = name.indexOf("[");
      if (open >= 0) {
        var close = name.indexOf("]");
        index = parseInt(name.substring(open + 1, close));
        name = name.substr(0, open)
      }
      if (!(name in program.uniforms)) return null;
      var id = nextId++;
      commandBuffer.push(16, program.id, fullname, id);
      return {
        what: "location",
        uniform: program.uniforms[name],
        id: id,
        index: index
      }
    };
    this.getProgramInfoLog = function (shader) {
      return ""
    };
    this.useProgram = function (program) {
      commandBuffer.push(17, program ? program.id : 0);
      bindings.program = program
    };
    this.uniform1i = function (location, data) {
      if (!location) return;
      commandBuffer.push(18, location.id, data)
    };
    this.uniform1f = function (location, data) {
      if (!location) return;
      commandBuffer.push(19, location.id, data)
    };
    this.uniform3fv = function (location, data) {
      if (!location) return;
      commandBuffer.push(20, location.id, new Float32Array(data))
    };
    this.uniform4f = function (location, x, y, z, w) {
      if (!location) return;
      commandBuffer.push(21, location.id, new Float32Array([x, y, z, w]))
    };
    this.uniform4fv = function (location, data) {
      if (!location) return;
      commandBuffer.push(21, location.id, new Float32Array(data))
    };
    this.uniformMatrix4fv = function (location, transpose, data) {
      if (!location) return;
      commandBuffer.push(22, location.id, transpose, new Float32Array(data))
    };
    this.vertexAttrib4fv = function (index, values) {
      commandBuffer.push(23, index, new Float32Array(values))
    };
    this.createBuffer = function () {
      var id = nextId++;
      commandBuffer.push(24, id);
      return new WebGLBuffer(id)
    };
    this.deleteBuffer = function (buffer) {
      if (!buffer) return;
      commandBuffer.push(25, buffer.id)
    };
    this.bindBuffer = function (target, buffer) {
      commandBuffer.push(26, target, buffer ? buffer.id : 0);
      switch (target) {
        case this.ARRAY_BUFFER_BINDING: {
          bindings.arrayBuffer = buffer;
          break
        }
        case this.ELEMENT_ARRAY_BUFFER_BINDING: {
          bindings.elementArrayBuffer = buffer;
          break
        }
      }
    };

    function duplicate(something) {
      if (!something || typeof something === "number") return something;
      if (something.slice) return something.slice(0);
      return new something.constructor(something)
    }
    this.bufferData = function (target, something, usage) {
      commandBuffer.push(27, target, duplicate(something), usage)
    };
    this.bufferSubData = function (target, offset, something) {
      commandBuffer.push(28, target, offset, duplicate(something))
    };
    this.viewport = function (x, y, w, h) {
      commandBuffer.push(29, x, y, w, h)
    };
    this.vertexAttribPointer = function (index, size, type, normalized, stride, offset) {
      commandBuffer.push(30, index, size, type, normalized, stride, offset)
    };
    this.enableVertexAttribArray = function (index) {
      commandBuffer.push(31, index)
    };
    this.disableVertexAttribArray = function (index) {
      commandBuffer.push(32, index)
    };
    this.drawArrays = function (mode, first, count) {
      commandBuffer.push(33, mode, first, count)
    };
    this.drawElements = function (mode, count, type, offset) {
      commandBuffer.push(34, mode, count, type, offset)
    };
    this.getError = function () {
      commandBuffer.push(35);
      return this.NO_ERROR
    };
    this.createTexture = function () {
      var id = nextId++;
      commandBuffer.push(36, id);
      return new WebGLTexture(id)
    };
    this.deleteTexture = function (texture) {
      if (!texture) return;
      commandBuffer.push(37, texture.id);
      texture.id = 0
    };
    this.isTexture = function (texture) {
      return texture && texture.what === "texture" && texture.id > 0 && texture.binding
    };
    this.bindTexture = function (target, texture) {
      switch (target) {
        case that.TEXTURE_2D: {
          bindings.texture2D = texture;
          break
        }
      }
      if (texture) texture.binding = target;
      commandBuffer.push(38, target, texture ? texture.id : 0)
    };
    this.texParameteri = function (target, pname, param) {
      commandBuffer.push(39, target, pname, param)
    };
    this.texImage2D = function (target, level, internalformat, width, height, border, format, type, pixels) {
      if (pixels === undefined) {
        format = width;
        type = height;
        pixels = border;
        assert(pixels instanceof Image);
        assert(internalformat === format && format === this.RGBA);
        assert(type === this.UNSIGNED_BYTE);
        var data = pixels.data;
        width = data.width;
        height = data.height;
        border = 0;
        pixels = new Uint8Array(data.data)
      }
      commandBuffer.push(40, target, level, internalformat, width, height, border, format, type, duplicate(pixels))
    };
    this.compressedTexImage2D = function (target, level, internalformat, width, height, border, pixels) {
      commandBuffer.push(41, target, level, internalformat, width, height, border, duplicate(pixels))
    };
    this.activeTexture = function (texture) {
      commandBuffer.push(42, texture);
      bindings.activeTexture = texture
    };
    this.getShaderParameter = function (shader, pname) {
      switch (pname) {
        case this.SHADER_TYPE:
          return shader.type;
        case this.COMPILE_STATUS: {
          commandBuffer.push(43, shader.id, pname);
          return true
        }
        default:
          throw "unsupported getShaderParameter " + pname
      }
    };
    this.clearDepth = function (depth) {
      commandBuffer.push(44, depth)
    };
    this.depthFunc = function (depth) {
      commandBuffer.push(45, depth)
    };
    this.frontFace = function (depth) {
      commandBuffer.push(46, depth)
    };
    this.cullFace = function (depth) {
      commandBuffer.push(47, depth)
    };
    this.readPixels = function (depth) {
      abort("readPixels is impossible, we are async GL")
    };
    this.pixelStorei = function (pname, param) {
      commandBuffer.push(48, pname, param)
    };
    this.depthMask = function (flag) {
      commandBuffer.push(49, flag)
    };
    this.depthRange = function (near, far) {
      commandBuffer.push(50, near, far)
    };
    this.blendFunc = function (sfactor, dfactor) {
      commandBuffer.push(51, sfactor, dfactor);
      bindings.blendSrcRGB = bindings.blendSrcAlpha = sfactor;
      bindings.blendDstRGB = bindings.blendDstAlpha = dfactor
    };
    this.scissor = function (x, y, width, height) {
      commandBuffer.push(52, x, y, width, height)
    };
    this.colorMask = function (red, green, blue, alpha) {
      commandBuffer.push(53, red, green, blue, alpha)
    };
    this.lineWidth = function (width) {
      commandBuffer.push(54, width)
    };
    this.createFramebuffer = function () {
      var id = nextId++;
      commandBuffer.push(55, id);
      return new WebGLFramebuffer(id)
    };
    this.deleteFramebuffer = function (framebuffer) {
      if (!framebuffer) return;
      commandBuffer.push(56, framebuffer.id)
    };
    this.bindFramebuffer = function (target, framebuffer) {
      commandBuffer.push(57, target, framebuffer ? framebuffer.id : 0);
      bindings.framebuffer = framebuffer
    };
    this.framebufferTexture2D = function (target, attachment, textarget, texture, level) {
      commandBuffer.push(58, target, attachment, textarget, texture ? texture.id : 0, level)
    };
    this.checkFramebufferStatus = function (target) {
      return this.FRAMEBUFFER_COMPLETE
    };
    this.createRenderbuffer = function () {
      var id = nextId++;
      commandBuffer.push(59, id);
      return new WebGLRenderbuffer(id)
    };
    this.deleteRenderbuffer = function (renderbuffer) {
      if (!renderbuffer) return;
      commandBuffer.push(60, renderbuffer.id)
    };
    this.bindRenderbuffer = function (target, renderbuffer) {
      commandBuffer.push(61, target, renderbuffer ? renderbuffer.id : 0)
    };
    this.renderbufferStorage = function (target, internalformat, width, height) {
      commandBuffer.push(62, target, internalformat, width, height)
    };
    this.framebufferRenderbuffer = function (target, attachment, renderbuffertarget, renderbuffer) {
      commandBuffer.push(63, target, attachment, renderbuffertarget, renderbuffer ? renderbuffer.id : 0)
    };
    this.debugPrint = function (text) {
      commandBuffer.push(64, text)
    };
    this.hint = function (target, mode) {
      commandBuffer.push(65, target, mode);
      if (target == this.GENERATE_MIPMAP_HINT) bindings.generateMipmapHint = mode
    };
    this.blendEquation = function (mode) {
      commandBuffer.push(66, mode);
      bindings.blendEquationRGB = bindings.blendEquationAlpha = mode
    };
    this.generateMipmap = function (target) {
      commandBuffer.push(67, target)
    };
    this.uniformMatrix3fv = function (location, transpose, data) {
      if (!location) return;
      commandBuffer.push(68, location.id, transpose, new Float32Array(data))
    };
    this.stencilMask = function (mask) {
      commandBuffer.push(69, mask)
    };
    this.clearStencil = function (s) {
      commandBuffer.push(70, s)
    };
    this.texSubImage2D = function (target, level, xoffset, yoffset, width, height, format, type, pixels) {
      if (pixels === undefined) {
        var formatTemp = format;
        format = width;
        type = height;
        pixels = formatTemp;
        assert(pixels instanceof Image);
        assert(format === this.RGBA);
        assert(type === this.UNSIGNED_BYTE);
        var data = pixels.data;
        width = data.width;
        height = data.height;
        pixels = new Uint8Array(data.data)
      }
      commandBuffer.push(71, target, level, xoffset, yoffset, width, height, format, type, duplicate(pixels))
    };
    this.uniform3f = function (location, x, y, z) {
      if (!location) return;
      commandBuffer.push(72, location.id, x, y, z)
    };
    this.blendFuncSeparate = function (srcRGB, dstRGB, srcAlpha, dstAlpha) {
      commandBuffer.push(73, srcRGB, dstRGB, srcAlpha, dstAlpha);
      bindings.blendSrcRGB = srcRGB;
      bindings.blendSrcAlpha = srcAlpha;
      bindings.blendDstRGB = dstRGB;
      bindings.blendDstAlpha = dstAlpha
    };
    this.uniform2fv = function (location, data) {
      if (!location) return;
      commandBuffer.push(74, location.id, new Float32Array(data))
    };
    this.texParameterf = function (target, pname, param) {
      commandBuffer.push(75, target, pname, param)
    };
    this.isContextLost = function () {
      commandBuffer.push(76);
      return false
    };
    this.isProgram = function (program) {
      return program && program.what === "program"
    };
    this.blendEquationSeparate = function (rgb, alpha) {
      commandBuffer.push(77, rgb, alpha);
      bindings.blendEquationRGB = rgb;
      bindings.blendEquationAlpha = alpha
    };
    this.stencilFuncSeparate = function (face, func, ref, mask) {
      commandBuffer.push(78, face, func, ref, mask)
    };
    this.stencilOpSeparate = function (face, fail, zfail, zpass) {
      commandBuffer.push(79, face, fail, zfail, zpass)
    };
    this.drawBuffersWEBGL = function (buffers) {
      commandBuffer.push(80, buffers)
    };
    this.uniform1iv = function (location, data) {
      if (!location) return;
      commandBuffer.push(81, location.id, new Int32Array(data))
    };
    this.uniform1fv = function (location, data) {
      if (!location) return;
      commandBuffer.push(82, location.id, new Float32Array(data))
    };
    var theoreticalTracker = new FPSTracker("server (theoretical)");
    var throttledTracker = new FPSTracker("server (client-throttled)");

    function preRAF() {
      if (Math.abs(frameId - clientFrameId) >= 4) {
        return false
      }
    }
    var postRAFed = false;

    function postRAF() {
      if (commandBuffer.length > 0) {
        postMessage({
          target: "gl",
          op: "render",
          commandBuffer: commandBuffer
        });
        commandBuffer = []
      }
      postRAFed = true
    }
    assert(!Browser.doSwapBuffers);
    Browser.doSwapBuffers = postRAF;
    var trueRAF = window.requestAnimationFrame;
    window.requestAnimationFrame = function (func) {
      trueRAF(function () {
        if (preRAF() === false) {
          window.requestAnimationFrame(func);
          return
        }
        postRAFed = false;
        func();
        if (!postRAFed) {
          postRAF()
        }
      })
    }
  }
  WebGLWorker.prototype.prefetchedParameters = {};
  WebGLWorker.prototype.prefetchedExtensions = {};
  WebGLWorker.prototype.prefetchedPrecisions = {};
  if (typeof console === "undefined") {
    var console = {
      log: function (x) {
        if (typeof dump === "function") dump("log: " + x + "\n")
      },
      debug: function (x) {
        if (typeof dump === "function") dump("debug: " + x + "\n")
      },
      info: function (x) {
        if (typeof dump === "function") dump("info: " + x + "\n")
      },
      warn: function (x) {
        if (typeof dump === "function") dump("warn: " + x + "\n")
      },
      error: function (x) {
        if (typeof dump === "function") dump("error: " + x + "\n")
      }
    }
  }

  function FPSTracker(text) {
    var last = 0;
    var mean = 0;
    var counter = 0;
    this.tick = function () {
      var now = Date.now();
      if (last > 0) {
        var diff = now - last;
        mean = .99 * mean + .01 * diff;
        if (counter++ === 60) {
          counter = 0;
          dump(text + " fps: " + (1e3 / mean).toFixed(2) + "\n")
        }
      }
      last = now
    }
  }

  function Element() {
    throw "TODO: Element"
  }
  var KeyboardEvent = {
    "DOM_KEY_LOCATION_RIGHT": 2
  };

  function PropertyBag() {
    this.addProperty = function () { };
    this.removeProperty = function () { };
    this.setProperty = function () { }
  }
  var IndexedObjects = {
    nextId: 1,
    cache: {},
    add: function (object) {
      object.id = this.nextId++;
      this.cache[object.id] = object
    }
  };

  function EventListener() {
    this.listeners = {};
    this.addEventListener = function addEventListener(event, func) {
      if (!this.listeners[event]) this.listeners[event] = [];
      this.listeners[event].push(func)
    };
    this.removeEventListener = function (event, func) {
      var list = this.listeners[event];
      if (!list) return;
      var me = list.indexOf(func);
      if (me < 0) return;
      list.splice(me, 1)
    };
    this.fireEvent = function fireEvent(event) {
      event.preventDefault = function () { };
      if (event.type in this.listeners) {
        this.listeners[event.type].forEach(function (listener) {
          listener(event)
        })
      }
    }
  }

  function Image() {
    IndexedObjects.add(this);
    EventListener.call(this);
    var src = "";
    Object.defineProperty(this, "src", {
      set: function (value) {
        src = value;
        assert(this.id);
        postMessage({
          target: "Image",
          method: "src",
          src: src,
          id: this.id
        })
      },
      get: function () {
        return src
      }
    })
  }
  Image.prototype.onload = function () { };
  Image.prototype.onerror = function () { };
  var window = this;
  var windowExtra = new EventListener;
  for (var x in windowExtra) window[x] = windowExtra[x];
  window.close = function window_close() {
    postMessage({
      target: "window",
      method: "close"
    })
  };
  window.alert = function (text) {
    err("alert forever: " + text);
    while (1) { }
  };
  window.scrollX = window.scrollY = 0;
  window.WebGLRenderingContext = WebGLWorker;
  window.requestAnimationFrame = function () {
    var nextRAF = 0;
    return function (func) {
      var now = Date.now();
      if (nextRAF === 0) {
        nextRAF = now + 1e3 / 60
      } else {
        while (now + 2 >= nextRAF) {
          nextRAF += 1e3 / 60
        }
      }
      var delay = Math.max(nextRAF - now, 0);
      setTimeout(func, delay)
    }
  }();
  var webGLWorker = new WebGLWorker;
  var document = new EventListener;
  document.createElement = function document_createElement(what) {
    switch (what) {
      case "canvas": {
        var canvas = new EventListener;
        canvas.ensureData = function canvas_ensureData() {
          if (!canvas.data || canvas.data.width !== canvas.width || canvas.data.height !== canvas.height) {
            canvas.data = {
              width: canvas.width,
              height: canvas.height,
              data: new Uint8Array(canvas.width * canvas.height * 4)
            };
            if (canvas === Module["canvas"]) {
              postMessage({
                target: "canvas",
                op: "resize",
                width: canvas.width,
                height: canvas.height
              })
            }
          }
        };
        canvas.getContext = function canvas_getContext(type, attributes) {
          if (canvas === Module["canvas"]) {
            postMessage({
              target: "canvas",
              op: "getContext",
              type: type,
              attributes: attributes
            })
          }
          if (type === "2d") {
            return {
              getImageData: function (x, y, w, h) {
                assert(x == 0 && y == 0 && w == canvas.width && h == canvas.height);
                canvas.ensureData();
                return {
                  width: canvas.data.width,
                  height: canvas.data.height,
                  data: new Uint8Array(canvas.data.data)
                }
              },
              putImageData: function (image, x, y) {
                canvas.ensureData();
                assert(x == 0 && y == 0 && image.width == canvas.width && image.height == canvas.height);
                canvas.data.data.set(image.data);
                if (canvas === Module["canvas"]) {
                  postMessage({
                    target: "canvas",
                    op: "render",
                    image: canvas.data
                  })
                }
              },
              drawImage: function (image, x, y, w, h, ox, oy, ow, oh) {
                assert(!x && !y && !ox && !oy);
                assert(w === ow && h === oh);
                assert(canvas.width === w || w === undefined);
                assert(canvas.height === h || h === undefined);
                assert(image.width === canvas.width && image.height === canvas.height);
                canvas.ensureData();
                canvas.data.data.set(image.data.data);
                if (canvas === Module["canvas"]) {
                  postMessage({
                    target: "canvas",
                    op: "render",
                    image: canvas.data
                  })
                }
              }
            }
          } else {
            return webGLWorker
          }
        };
        canvas.boundingClientRect = {};
        canvas.getBoundingClientRect = function canvas_getBoundingClientRect() {
          return {
            width: canvas.boundingClientRect.width,
            height: canvas.boundingClientRect.height,
            top: canvas.boundingClientRect.top,
            left: canvas.boundingClientRect.left,
            bottom: canvas.boundingClientRect.bottom,
            right: canvas.boundingClientRect.right
          }
        };
        canvas.style = new PropertyBag;
        canvas.exitPointerLock = function () { };
        canvas.width_ = canvas.width_ || 0;
        canvas.height_ = canvas.height_ || 0;
        Object.defineProperty(canvas, "width", {
          set: function (value) {
            canvas.width_ = value;
            if (canvas === Module["canvas"]) {
              postMessage({
                target: "canvas",
                op: "resize",
                width: canvas.width_,
                height: canvas.height_
              })
            }
          },
          get: function () {
            return canvas.width_
          }
        });
        Object.defineProperty(canvas, "height", {
          set: function (value) {
            canvas.height_ = value;
            if (canvas === Module["canvas"]) {
              postMessage({
                target: "canvas",
                op: "resize",
                width: canvas.width_,
                height: canvas.height_
              })
            }
          },
          get: function () {
            return canvas.height_
          }
        });
        var style = {
          parentCanvas: canvas,
          removeProperty: function () { },
          setProperty: function () { }
        };
        Object.defineProperty(style, "cursor", {
          set: function (value) {
            if (!style.cursor_ || style.cursor_ !== value) {
              style.cursor_ = value;
              if (style.parentCanvas === Module["canvas"]) {
                postMessage({
                  target: "canvas",
                  op: "setObjectProperty",
                  object: "style",
                  property: "cursor",
                  value: style.cursor_
                })
              }
            }
          },
          get: function () {
            return style.cursor_
          }
        });
        canvas.style = style;
        return canvas
      }
      default:
        throw "document.createElement " + what
    }
  };
  document.getElementById = function (id) {
    if (id === "canvas" || id === "application-canvas") {
      return Module.canvas
    }
    throw "document.getElementById failed on " + id
  };
  document.querySelector = function (id) {
    if (id === "#canvas" || id === "#application-canvas" || id === "canvas" || id === "application-canvas") {
      return Module.canvas
    }
    throw "document.querySelector failed on " + id
  };
  document.documentElement = {};
  document.styleSheets = [{
    cssRules: [],
    insertRule: function (rule, i) {
      this.cssRules.splice(i, 0, rule)
    }
  }];
  document.URL = "http://worker.not.yet.ready.wait.for.window.onload?fake";

  function Audio() {
    warnOnce("faking Audio elements, no actual sound will play")
  }
  Audio.prototype = new EventListener;
  Object.defineProperty(Audio.prototype, "src", {
    set: function (value) {
      if (value[0] === "d") return;
      this.onerror()
    }
  });
  Audio.prototype.play = function () { };
  Audio.prototype.pause = function () { };
  Audio.prototype.cloneNode = function () {
    return new Audio
  };

  function AudioContext() {
    warnOnce("faking WebAudio elements, no actual sound will play");

    function makeNode() {
      return {
        connect: function () { },
        disconnect: function () { }
      }
    }
    this.listener = {
      setPosition: function () { },
      setOrientation: function () { }
    };
    this.decodeAudioData = function () { };
    this.createBuffer = makeNode;
    this.createBufferSource = makeNode;
    this.createGain = makeNode;
    this.createPanner = makeNode
  }
  var screen = {
    width: 0,
    height: 0
  };
  Module.canvas = document.createElement("canvas");
  Module.setStatus = function () { };
  out = function Module_print(x) {
    postMessage({
      target: "stdout",
      content: x
    })
  };
  err = function Module_printErr(x) {
    postMessage({
      target: "stderr",
      content: x
    })
  };
  var frameId = 0;
  var clientFrameId = 0;
  var postMainLoop = Module["postMainLoop"];
  Module["postMainLoop"] = function () {
    if (postMainLoop) postMainLoop();
    postMessage({
      target: "tick",
      id: frameId++
    });
    commandBuffer = []
  };
  addRunDependency("gl-prefetch");
  addRunDependency("worker-init");
  var messageBuffer = null;
  var messageResenderTimeout = null;

  function messageResender() {
    if (calledMain) {
      assert(messageBuffer && messageBuffer.length > 0);
      messageResenderTimeout = null;
      messageBuffer.forEach(function (message) {
        onmessage(message)
      });
      messageBuffer = null
    } else {
      messageResenderTimeout = setTimeout(messageResender, 100)
    }
  }

  function onMessageFromMainEmscriptenThread(message) {
    /*
    if (!calledMain && !message.data.preMain) {
      if (!messageBuffer) {
        messageBuffer = [];
        messageResenderTimeout = setTimeout(messageResender, 100)
      }
      messageBuffer.push(message);
      return
    }
    */
    if (calledMain && messageResenderTimeout) {
      clearTimeout(messageResenderTimeout);
      messageResender()
    }
    switch (message.data.target) {
      case "document": {
        document.fireEvent(message.data.event);
        break
      }
      case "window": {
        window.fireEvent(message.data.event);
        break
      }
      case "canvas": {
        if (message.data.event) {
          Module.canvas.fireEvent(message.data.event)
        } else if (message.data.boundingClientRect) {
          Module.canvas.boundingClientRect = message.data.boundingClientRect
        } else throw "ey?";
        break
      }
      case "gl": {
        webGLWorker.onmessage(message.data);
        break
      }
      case "tock": {
        clientFrameId = message.data.id;
        break
      }
      case "Image": {
        var img = IndexedObjects.cache[message.data.id];
        switch (message.data.method) {
          case "onload": {
            img.width = message.data.width;
            img.height = message.data.height;
            img.data = {
              width: img.width,
              height: img.height,
              data: message.data.data
            };
            img.complete = true;
            img.onload();
            break
          }
          case "onerror": {
            img.onerror({
              srcElement: img
            });
            break
          }
        }
        break
      }
      case "IDBStore": {
        assert(message.data.method === "response");
        assert(IDBStore.pending);
        IDBStore.pending(message.data);
        break
      }
      case "worker-init": {
        Module.canvas = document.createElement("canvas");
        screen.width = Module.canvas.width_ = message.data.width;
        screen.height = Module.canvas.height_ = message.data.height;
        Module.canvas.boundingClientRect = message.data.boundingClientRect;
        document.URL = message.data.URL;
        window.fireEvent({
          type: "load"
        });
        removeRunDependency("worker-init");

        break
      }
      case "custom": {
        if (Module["onCustomMessage"]) {
          Module["onCustomMessage"](message)
        } else {
          throw "Custom message received but worker Module.onCustomMessage not implemented."
        }
        break
      }
      case "setimmediate": {
        if (Module["setImmediates"]) Module["setImmediates"].shift()();
        break
      }
      default:
        throw "wha? " + message.data.target
    }
  }

  onmessage = onMessageFromMainEmscriptenThread;
  if (typeof __specialEventTargets !== "undefined") {
    __specialEventTargets = [0, document, window]
  }
}
Module["asm"] = asm;
Module["getMemory"] = getMemory;
Module["UTF8ToString"] = UTF8ToString;
Module["stringToUTF8"] = stringToUTF8;
Module["lengthBytesUTF8"] = lengthBytesUTF8;
Module["UTF16ToString"] = UTF16ToString;
Module["addRunDependency"] = addRunDependency;
Module["removeRunDependency"] = removeRunDependency;
Module["FS"] = FS;
Module["FS_createFolder"] = FS.createFolder;
Module["FS_createPath"] = FS.createPath;
Module["FS_createDataFile"] = FS.createDataFile;
Module["FS_createPreloadedFile"] = FS.createPreloadedFile;
Module["FS_createLazyFile"] = FS.createLazyFile;
Module["FS_createLink"] = FS.createLink;
Module["FS_createDevice"] = FS.createDevice;
Module["FS_unlink"] = FS.unlink;
Module["callMain"] = callMain;
Module["calledRun"] = calledRun;
var calledRun;

function ExitStatus(status) {
  this.name = "ExitStatus";
  this.message = "Program terminated with exit(" + status + ")";
  this.status = status
}
var calledMain = false;
dependenciesFulfilled = function runCaller() {
  if (!calledRun) run();
  if (!calledRun) dependenciesFulfilled = runCaller
};

function callMain(args) {

  args = args || [];
  var argc = args.length + 1;
  var argv = stackAlloc((argc + 1) * 4);
  HEAP32[argv >> 2] = allocateUTF8OnStack(thisProgram);
  for (var i = 1; i < argc; i++) {
    HEAP32[(argv >> 2) + i] = allocateUTF8OnStack(args[i - 1])
  }
  HEAP32[(argv >> 2) + argc] = 0;
  var initialEmtStackTop = Module["emtStackSave"]();
  try {
    var ret = Module["_main"](argc, argv);
    if (!noExitRuntime) {
      exit(ret, true)
    }
  } catch (e) {
    if (e instanceof ExitStatus) {
      return
    } else if (e == "SimulateInfiniteLoop") {
      noExitRuntime = true;
      Module["emtStackRestore"](initialEmtStackTop);
      return
    } else {
      var toLog = e;
      if (e && typeof e === "object" && e.stack) {
        toLog = [e, e.stack]
      }
      err("exception thrown: " + toLog);
      quit_(1, e)
    }
  } finally {
    calledMain = true
  }
}

function run(args) {

  args = args || arguments_;
  if (runDependencies > 0) {
    return
  }
  preRun();
  if (runDependencies > 0) return;

  function doRun() {
    if (calledRun) return;
    calledRun = true;
    Module["calledRun"] = true;
    if (ABORT) return;
    initRuntime();
    preMain();
    if (Module["onRuntimeInitialized"]) Module["onRuntimeInitialized"]();
    if (shouldRunNow) callMain(args);
    postRun()
  }
  if (Module["setStatus"]) {
    Module["setStatus"]("Running...");
    setTimeout(function () {
      setTimeout(function () {
        Module["setStatus"]("")
      }, 1);
      doRun()
    }, 1)
  } else {
    doRun()
  }
}
Module["run"] = run;

function exit(status, implicit) {
  if (implicit && noExitRuntime && status === 0) {
    return
  }
  if (noExitRuntime) { } else {
    ABORT = true;
    EXITSTATUS = status;
    exitRuntime();
    if (Module["onExit"]) Module["onExit"](status)
  }
  quit_(status, new ExitStatus(status))
}
if (Module["preInit"]) {
  if (typeof Module["preInit"] == "function") Module["preInit"] = [Module["preInit"]];
  while (Module["preInit"].length > 0) {
    Module["preInit"].pop()()
  }
}
var shouldRunNow = false;
if (Module["noInitialRun"]) shouldRunNow = false;
noExitRuntime = true;
