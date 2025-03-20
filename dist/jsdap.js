const atomicTypes = ["byte", "int", "uint", "int16", "uint16", "int32", "uint32", "float32", "float64", "string", "url", "alias"], structures = ["Sequence", "Structure", "Dataset"], IDENTIFIER_REGEX = "[\\w-/]";
Array.prototype.contains = function(n) {
  for (let t = 0, e = this[t]; t < this.length; e = this[++t])
    if (n == e) return !0;
  return !1;
};
String.prototype.trim = function() {
  return this.replace(/^\s+|\s+$/g, "");
};
String.prototype.ltrim = function() {
  return this.replace(/^[\s\n\r\t]+/, "");
};
String.prototype.rtrim = function() {
  return this.replace(/\s+$/, "");
};
function pseudoSafeEval(str) {
  return /^[,:{}\[\]0-9.\-+Eaeflnr-u \n\r\t]*$/.test(str.replace(/\\./g, "@").replace(/"[^"\\\n\r]*"/g, "")) ? eval("(" + str + ")") : str;
}
class dapType {
  constructor(t) {
    this.type = t, this.attributes = {};
  }
}
class simpleParser {
  constructor(t) {
    this.stream = t;
  }
  peek(t) {
    let e = new RegExp("^" + t, "i"), s = this.stream.match(e);
    return s ? s[0] : "";
  }
  consume(t) {
    let e = new RegExp("^" + t, "i");
    this.stream = this.stream.replace(/(?:\r\n|\r|\n)/g, ""), this.stream = this.stream.replace(/\\/g, "/");
    let s = this.stream.match(e);
    if (s)
      return this.stream = this.stream.substr(s[0].length).ltrim(), s[0];
    throw new Error("Unable to parse stream: " + this.stream.substr(0, 10));
  }
}
class ddsParser extends simpleParser {
  constructor(t) {
    super(t), this.dds = t;
  }
  parse() {
    let t = new dapType("Dataset");
    for (this.consume("dataset"), this.consume("{"); !this.peek("}"); ) {
      let s = this._declaration();
      t[s.name] = s;
    }
    this.consume("}"), t.id = t.name = this.consume("[^;]+"), this.consume(";");
    function e(s, r) {
      for (let i in s) {
        let a = s[i];
        a.type && (a.id = a.name, r && (a.id = s.id + "." + a.id), e(a, !0));
      }
    }
    return e(t, !1), t;
  }
  _declaration() {
    switch (this.peek(IDENTIFIER_REGEX + "+").toLowerCase()) {
      case "grid":
        return this._grid();
      case "structure":
        return this._structure();
      case "sequence":
        return this._sequence();
      default:
        return this._base_declaration();
    }
  }
  _base_declaration() {
    let t = new dapType();
    for (t.type = this.consume(IDENTIFIER_REGEX + "+"), t.name = this.consume(IDENTIFIER_REGEX + "+"), t.dimensions = [], t.shape = []; !this.peek(";"); ) {
      this.consume("\\[");
      let e = this.consume(IDENTIFIER_REGEX + "+");
      this.peek("=") && (t.dimensions.push(e), this.consume("="), e = this.consume("\\d+")), t.shape.push(parseInt(e)), this.consume("\\]");
    }
    return this.consume(";"), t;
  }
  _grid() {
    let t = new dapType("Grid");
    for (this.consume("grid"), this.consume("{"), this.consume("array"), this.consume(":"), t.array = this._base_declaration(), this.consume("maps"), this.consume(":"), t.maps = {}; !this.peek("}"); ) {
      let e = this._base_declaration();
      t.maps[e.name] = e;
    }
    return this.consume("}"), t.name = this.consume(IDENTIFIER_REGEX + "+"), this.consume(";"), t;
  }
  _sequence() {
    let t = new dapType("Sequence");
    for (this.consume("sequence"), this.consume("{"); !this.peek("}"); ) {
      let e = this._declaration();
      t[e.name] = e;
    }
    return this.consume("}"), t.name = this.consume(IDENTIFIER_REGEX + "+"), this.consume(";"), t;
  }
  _structure() {
    let t = new dapType("Structure");
    for (this.consume("structure"), this.consume("{"); !this.peek("}"); ) {
      let e = this._declaration();
      t[e.name] = e;
    }
    for (this.consume("}"), t.name = this.consume(IDENTIFIER_REGEX + "+"), t.dimensions = [], t.shape = []; !this.peek(";"); ) {
      this.consume("\\[");
      let e = this.consume(IDENTIFIER_REGEX + "+");
      this.peek("=") && (t.dimensions.push(e), this.consume("="), e = this.consume("\\d+")), t.shape.push(parseInt(e)), this.consume("\\]");
    }
    return this.consume(";"), t;
  }
}
class dasParser extends simpleParser {
  constructor(t, e) {
    super(t), this.das = t, this.dataset = e;
  }
  parse() {
    for (this._target = this.dataset, this.consume("attributes"), this.consume("{"); !this.peek("}"); )
      this._attr_container();
    return this.consume("}"), this.dataset;
  }
  _attr_container() {
    if (atomicTypes.contains(this.peek(IDENTIFIER_REGEX + "+").toLowerCase())) {
      if (this._attribute(this._target.attributes), this._target.type == "Grid") {
        for (let t in this._target.maps)
          if (this.dataset[t]) {
            let e = this._target.maps[t];
            for (let s in e.attributes)
              this.dataset[t].attributes[s] = e.attributes[s];
          }
      }
    } else
      this._container();
  }
  _container() {
    let t = this.consume("[\\w-_\\./]+");
    if (this.consume("{"), t.indexOf(".") > -1) {
      let e = t.split("."), s = this._target;
      for (let r = 0; r < e.length; r++)
        this._target = this._target[e[r]];
      for (; !this.peek("}"); )
        this._attr_container();
      this.consume("}"), this._target = s;
    } else if (structures.contains(this._target.type) && this._target[t]) {
      let e = this._target;
      for (this._target = e[t]; !this.peek("}"); )
        this._attr_container();
      this.consume("}"), this._target = e;
    } else
      this._target.attributes[t] = this._metadata(), this.consume("}");
  }
  _metadata() {
    let t = {};
    for (; !this.peek("}"); )
      if (atomicTypes.contains(this.peek(IDENTIFIER_REGEX + "+").toLowerCase()))
        this._attribute(t);
      else {
        let e = this.consume(IDENTIFIER_REGEX + "+");
        this.consume("{"), t[e] = this._metadata(), this.consume("}");
      }
    return t;
  }
  _attribute(t) {
    let e = this.consume(IDENTIFIER_REGEX + "+"), s = this.consume(IDENTIFIER_REGEX + "+"), r = [];
    for (; !this.peek(";"); ) {
      let i = this.consume('".*?[^\\\\]"|[^;,]+');
      if (e.toLowerCase() == "string" || e.toLowerCase() == "url")
        i = pseudoSafeEval(i);
      else if (e.toLowerCase() == "alias") {
        let a, u;
        i.match(/^\\./) ? (u = i.substring(1).split("."), a = this.dataset) : (u = i.split("."), a = this._target);
        for (let o = 0; o < u.length; o++) {
          let c = u[o];
          a[c] ? a = a[c] : a.array.name == c ? a = a.array : a.maps[c] ? a = a.maps[c] : a = a.attributes[c], i = a;
        }
      } else
        i.toLowerCase() == "nan" ? i = NaN : i = pseudoSafeEval(i);
      r.push(i), this.peek(",") && this.consume(",");
    }
    this.consume(";"), r.length == 1 && (r = r[0]), t[s] = r;
  }
}
function ieHack(n) {
  if (n) {
    let t = document.createElement("script");
    t.setAttribute("type", "text/vbscript"), t.innerHTML = `
            Function BinaryToArray(Binary)
 Dim i
 ReDim byteArray(LenB(Binary))
            For i = 1 To LenB(Binary)
 byteArray(i-1) = AscB(MidB(Binary, i, 1))
            Next
 BinaryToArray = byteArray
 End Function
 `, document.head.appendChild(t);
  }
}
const START_OF_SEQUENCE = "Z\0\0\0";
class dapUnpacker {
  constructor(t, e) {
    this._buf = t, this.dapvar = e, this._pos = 0;
  }
  getValue() {
    var t = this._pos, e = this.dapvar.type.toLowerCase();
    if (e == "structure" || e == "dataset") {
      var h = [], s, r = this.dapvar;
      for (var i in r)
        r[i].type && (this.dapvar = r[i], s = this.getValue(), h.push(s));
      return this.dapvar = r, h;
    } else if (e == "grid") {
      var h = [], s;
      r = this.dapvar, this.dapvar = r.array, s = this.getValue(), h.push(s);
      for (var a in r.maps)
        this.dapvar = r.maps[a], s = this.getValue(), h.push(s);
      return this.dapvar = r, h;
    } else if (e == "sequence") {
      var u = this._unpack_uint32(), h = [], o, s;
      for (r = this.dapvar; u != 2768240640; ) {
        o = [];
        for (var i in r)
          r[i].type && (this.dapvar = r[i], s = this.getValue(), o.push(s));
        h.push(o), u = this._unpack_uint32();
      }
      return this.dapvar = r, h;
    } else if (this._buf.slice(t, t + 4) == START_OF_SEQUENCE) {
      for (var u = this._unpack_uint32(), h = [], s; u != 2768240640; )
        s = this.getValue(), h.push(s), u = this._unpack_uint32();
      return h;
    }
    var c = 1;
    this.dapvar.shape.length && (c = this._unpack_uint32(), e != "url" && e != "string" && this._unpack_uint32());
    var h;
    if (e == "byte")
      h = this._unpack_bytes(c);
    else if (e == "url" || e == "string")
      h = this._unpack_string(c);
    else {
      h = [];
      var p;
      switch (e) {
        case "float32":
          p = "_unpack_float32";
          break;
        case "float64":
          p = "_unpack_float64";
          break;
        case "int":
          p = "_unpack_int32";
          break;
        case "uint":
          p = "_unpack_uint32";
          break;
        case "int16":
          p = "_unpack_int16";
          break;
        case "uint16":
          p = "_unpack_uint16";
          break;
        case "int32":
          p = "_unpack_int32";
          break;
        case "uint32":
          p = "_unpack_uint32";
          break;
      }
      for (var t = 0; t < c; t++)
        h.push(this[p]());
    }
    return this.dapvar.shape ? h = reshape(h, this.dapvar.shape) : h = h[0], h;
  }
  _unpack_byte() {
    var t = 1, e = !1, s = this._pos;
    this._pos = s + t;
    var r = this._buf.slice(s, s + t);
    return decodeInt(r, t, e);
  }
  _unpack_uint16() {
    var t = 4, e = !1, s = this._pos;
    this._pos = s + t;
    var r = this._buf.slice(s, s + t);
    return decodeInt(r, t, e);
  }
  _unpack_uint32() {
    var t = 4, e = !1, s = this._pos;
    this._pos = s + t;
    var r = this._buf.slice(s, s + t);
    return decodeInt(r, t, e);
  }
  _unpack_int16() {
    var t = 4, e = !0, s = this._pos;
    this._pos = s + t;
    var r = this._buf.slice(s, s + t);
    return decodeInt(r, t, e);
  }
  _unpack_int32() {
    var t = 4, e = !0, s = this._pos;
    this._pos = s + t;
    var r = this._buf.slice(s, s + t);
    return decodeInt(r, t, e);
  }
  _unpack_float32() {
    var t = 23, e = 8, s = 4, r = this._pos;
    this._pos = r + s;
    var i = this._buf.slice(r, r + s);
    return decodeFloat(i, t, e);
  }
  _unpack_float64() {
    var t = 52, e = 11, s = 8, r = this._pos;
    this._pos = r + s;
    var i = this._buf.slice(r, r + s);
    return decodeFloat(i, t, e);
  }
  _unpack_bytes(t) {
    for (var e = this._pos, s = [], r = 0; r < t; r++)
      s.push(this._unpack_byte());
    var i = (4 - t % 4) % 4;
    return this._pos = e + t + i, s;
  }
  _unpack_string(t) {
    for (var e = [], s, r, i, a, u = 0; u < t; u++) {
      s = this._unpack_uint32(), r = this._pos, i = this._buf.slice(r, r + s), a = (4 - s % 4) % 4, this._pos = r + s + a;
      for (var o = "", r = 0; r < s; r++)
        o += String.fromCharCode(i[r]);
      e.push(o);
    }
    return e;
  }
}
function getBuffer(n) {
  for (var t = new Array(n.length), e = 0; e < n.length; e++)
    t[e] = n.charCodeAt(e) & 255;
  return t;
}
function reshape(n, t) {
  if (!t.length) return n[0];
  for (var e = [], s, r, i, a = 0; a < t[0]; a++)
    s = n.length / t[0], r = a * s, i = r + s, e.push(reshape(n.slice(r, i), t.slice(1)));
  return e;
}
function shl(n, t) {
  for (++t; --t; n = ((n %= 2147483648) & 1073741824) == 1073741824 ? n * 2 : (n - 1073741824) * 2 + 2147483647 + 1) ;
  return n;
}
function readBits(n, t, e) {
  if (t < 0 || e <= 0) return 0;
  for (var s, r = t % 8, i = n.length - (t >> 3) - 1, a = n.length + (-(t + e) >> 3), u = i - a, o = (n[i] >> r & (1 << (u ? 8 - r : e)) - 1) + (u && (s = (t + e) % 8) ? (n[a++] & (1 << s) - 1) << (u-- << 3) - r : 0); u; o += shl(n[a++], (u-- << 3) - r)) ;
  return o;
}
function decodeInt(n, t, e) {
  var s = readBits(n, 0, t * 8), r = Math.pow(2, t * 8), i;
  return e && s >= r / 2 ? i = s - r : i = s, i;
}
function decodeFloat(n, t, e) {
  var s = Math.pow(2, e - 1) - 1, r = readBits(n, t + e, 1), i = readBits(n, t, e), a = 0, u = 2, o = n.length + (-t >> 3) - 1, c, h, p;
  do
    for (c = n[++o], h = t % 8 || 8, p = 1 << h; p >>= 1; c & p && (a += 1 / u), u *= 2) ;
  while (t -= h);
  return i == (s << 1) + 1 ? a ? NaN : r ? -1 / 0 : 1 / 0 : (1 + r * -2) * (i || a ? i ? Math.pow(2, i - s) * (1 + a) : Math.pow(2, -s + 1) * a : 0);
}
class JsDap {
  constructor(t = !1) {
    this.IE_HACK = t, ieHack(this.IE_HACK);
  }
  proxyUrl(t, e, s, r, i) {
    return new Promise((a, u) => {
      let o;
      if (window.XMLHttpRequest ? o = new XMLHttpRequest() : window.ActiveXObject && (o = new window.ActiveXObject("Microsoft.XMLHTTP")), o.open("GET", t, !0), i === !0 && (o.withCredentials = !0), o.overrideMimeType ? o.overrideMimeType("text/plain; charset=x-user-defined") : o.setRequestHeader("Accept-Charset", "x-user-defined"), r)
        for (let c in r)
          o.setRequestHeader(c, r[c]);
      o.onreadystatechange = function() {
        try {
          o.readyState == 4 && (o.status === 200 ? s ? this.IE_HACK ? a(e(BinaryToArray(o.responseBody).toArray())) : a(e(getBuffer(o.responseText))) : a(e(o.responseText)) : (console.error(`Error: jsdap.proxyUrl xml request status is not 200, status is: ${o.status}, url: ${t}`), u(new Error(`Error: xml request status is not 200, status is: ${o.status}, url: ${t}`))));
        } catch (c) {
          console.error("Error: jsdap.proxyUrl failed to invoke the callback. ", c), u(c);
        }
      }, o.send("");
    });
  }
  /** Flatten the data array as data attributes of elements of daplet */
  _applydata(t, e) {
    let s = 0;
    for (let r in e)
      e[r].type && (e[r].data = t[s++], e[r].type == "Structure" && this._applydata(e[r].data, e[r]));
  }
  /**
   * Load the dataset and call the callback with (data) where data is an array of data
   * the url must be a url with .dods extension.
   * @params:
   * - url (string): the url (must be a .dods url, it might have additonnal slicing OpENDAP query string)
   * - callback (function(data)): the callback which will receive parsed data.
   * - extraheaders (map/object) : Javascript Object or map that contains keys and values of additonnal headers for the request.
   */
  async loadData(t, e, s, r) {
    try {
      await this.proxyUrl(
        t,
        (i) => {
          let a = "";
          for (; !a.match(/\nData:\n$/); ) {
            let c = i.splice(0, 1);
            if (c.length === 0) throw new Error("Error reading data, are you sur this is a .dods request ?");
            a += String.fromCharCode(c);
          }
          a = a.substr(0, a.length - 7);
          let u = new ddsParser(a).parse(), o = new dapUnpacker(i, u).getValue();
          this._applydata(o, u), e(u);
        },
        !0,
        s,
        r
      );
    } catch (i) {
      throw console.error("Error loading data from jsdap:", i), i;
    }
  }
  /**
   * Load the dataset and call the callback with (dataset) where dataset is the dataset "metadata";
   * - url (string): the url (must be a bare OPeNDAP url, without "format extension" nor query parameters).
   * - callback (function(data)): the callback which will receive parsed data.
   * - extraheaders (map/object) : Javascript Object or map that contains keys and values of additonnal headers for the request.
   */
  async loadDataset(t, e, s, r) {
    try {
      await this.proxyUrl(
        t + ".dds",
        async (i) => {
          let a = new ddsParser(i).parse();
          await this.proxyUrl(
            t + ".das",
            function(u) {
              a = new dasParser(u, a).parse(), e(a);
            },
            !1,
            s,
            r
          );
        },
        !1,
        s,
        r
      );
    } catch (i) {
      throw console.error("Error loading dataset from jsdap:", i), i;
    }
  }
}
export {
  JsDap as default
};
