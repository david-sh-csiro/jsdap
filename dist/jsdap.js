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
    function e(s, i) {
      for (let a in s) {
        let r = s[a];
        r.type && (r.id = r.name, i && (r.id = s.id + "." + r.id), e(r, !0));
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
            let e = this._target.maps[e];
            for (let s in e.attributes)
              this.dataset[e].attributes[s] = e.attributes[s];
          }
      }
    } else
      this._container();
  }
  _container() {
    let t = this.consume("[\\w-_\\./]+");
    if (this.consume("{"), t.indexOf(".") > -1) {
      let e = t.split("."), s = this._target;
      for (let i = 0; i < e.length; i++)
        this._target = this._target[e[i]];
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
    let e = this.consume(IDENTIFIER_REGEX + "+"), s = this.consume(IDENTIFIER_REGEX + "+"), i = [];
    for (; !this.peek(";"); ) {
      let a = this.consume('".*?[^\\\\]"|[^;,]+');
      if (e.toLowerCase() == "string" || e.toLowerCase() == "url")
        a = pseudoSafeEval(a);
      else if (e.toLowerCase() == "alias") {
        let r, u;
        a.match(/^\\./) ? (u = a.substring(1).split("."), r = this.dataset) : (u = a.split("."), r = this._target);
        for (let o = 0; o < u.length; o++) {
          let c = u[o];
          r[c] ? r = r[c] : r.array.name == c ? r = r.array : r.maps[c] ? r = r.maps[c] : r = r.attributes[c], a = r;
        }
      } else
        a.toLowerCase() == "nan" ? a = NaN : a = pseudoSafeEval(a);
      i.push(a), this.peek(",") && this.consume(",");
    }
    this.consume(";"), i.length == 1 && (i = i[0]), t[s] = i;
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
      var h = [], s, i = this.dapvar;
      for (var a in i)
        i[a].type && (this.dapvar = i[a], s = this.getValue(), h.push(s));
      return this.dapvar = i, h;
    } else if (e == "grid") {
      var h = [], s;
      i = this.dapvar, this.dapvar = i.array, s = this.getValue(), h.push(s);
      for (var r in i.maps)
        this.dapvar = i.maps[r], s = this.getValue(), h.push(s);
      return this.dapvar = i, h;
    } else if (e == "sequence") {
      var u = this._unpack_uint32(), h = [], o, s;
      for (i = this.dapvar; u != 2768240640; ) {
        o = [];
        for (var a in i)
          i[a].type && (this.dapvar = i[a], s = this.getValue(), o.push(s));
        h.push(o), u = this._unpack_uint32();
      }
      return this.dapvar = i, h;
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
    var i = this._buf.slice(s, s + t);
    return decodeInt(i, t, e);
  }
  _unpack_uint16() {
    var t = 4, e = !1, s = this._pos;
    this._pos = s + t;
    var i = this._buf.slice(s, s + t);
    return decodeInt(i, t, e);
  }
  _unpack_uint32() {
    var t = 4, e = !1, s = this._pos;
    this._pos = s + t;
    var i = this._buf.slice(s, s + t);
    return decodeInt(i, t, e);
  }
  _unpack_int16() {
    var t = 4, e = !0, s = this._pos;
    this._pos = s + t;
    var i = this._buf.slice(s, s + t);
    return decodeInt(i, t, e);
  }
  _unpack_int32() {
    var t = 4, e = !0, s = this._pos;
    this._pos = s + t;
    var i = this._buf.slice(s, s + t);
    return decodeInt(i, t, e);
  }
  _unpack_float32() {
    var t = 23, e = 8, s = 4, i = this._pos;
    this._pos = i + s;
    var a = this._buf.slice(i, i + s);
    return decodeFloat(a, t, e);
  }
  _unpack_float64() {
    var t = 52, e = 11, s = 8, i = this._pos;
    this._pos = i + s;
    var a = this._buf.slice(i, i + s);
    return decodeFloat(a, t, e);
  }
  _unpack_bytes(t) {
    for (var e = this._pos, s = [], i = 0; i < t; i++)
      s.push(this._unpack_byte());
    var a = (4 - t % 4) % 4;
    return this._pos = e + t + a, s;
  }
  _unpack_string(t) {
    for (var e = [], s, i, a, r, u = 0; u < t; u++) {
      s = this._unpack_uint32(), i = this._pos, a = this._buf.slice(i, i + s), r = (4 - s % 4) % 4, this._pos = i + s + r;
      for (var o = "", i = 0; i < s; i++)
        o += String.fromCharCode(a[i]);
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
  for (var e = [], s, i, a, r = 0; r < t[0]; r++)
    s = n.length / t[0], i = r * s, a = i + s, e.push(reshape(n.slice(i, a), t.slice(1)));
  return e;
}
function shl(n, t) {
  for (++t; --t; n = ((n %= 2147483648) & 1073741824) == 1073741824 ? n * 2 : (n - 1073741824) * 2 + 2147483647 + 1) ;
  return n;
}
function readBits(n, t, e) {
  if (t < 0 || e <= 0) return 0;
  for (var s, i = t % 8, a = n.length - (t >> 3) - 1, r = n.length + (-(t + e) >> 3), u = a - r, o = (n[a] >> i & (1 << (u ? 8 - i : e)) - 1) + (u && (s = (t + e) % 8) ? (n[r++] & (1 << s) - 1) << (u-- << 3) - i : 0); u; o += shl(n[r++], (u-- << 3) - i)) ;
  return o;
}
function decodeInt(n, t, e) {
  var s = readBits(n, 0, t * 8), i = Math.pow(2, t * 8), a;
  return e && s >= i / 2 ? a = s - i : a = s, a;
}
function decodeFloat(n, t, e) {
  var s = Math.pow(2, e - 1) - 1, i = readBits(n, t + e, 1), a = readBits(n, t, e), r = 0, u = 2, o = n.length + (-t >> 3) - 1, c, h, p;
  do
    for (c = n[++o], h = t % 8 || 8, p = 1 << h; p >>= 1; c & p && (r += 1 / u), u *= 2) ;
  while (t -= h);
  return a == (s << 1) + 1 ? r ? NaN : i ? -1 / 0 : 1 / 0 : (1 + i * -2) * (a || r ? a ? Math.pow(2, a - s) * (1 + r) : Math.pow(2, -s + 1) * r : 0);
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
class JsDap {
  constructor(t = !1) {
    this.IE_HACK = t, ieHack(this.IE_HACK);
  }
  proxyUrl(t, e, s, i, a) {
    let r;
    if (window.XMLHttpRequest ? r = new XMLHttpRequest() : window.ActiveXObject && (r = new window.ActiveXObject("Microsoft.XMLHTTP")), r.open("GET", t, !0), a === !0 && (r.withCredentials = !0), r.overrideMimeType ? r.overrideMimeType("text/plain; charset=x-user-defined") : r.setRequestHeader("Accept-Charset", "x-user-defined"), i)
      for (let u in i)
        r.setRequestHeader(u, i[u]);
    r.onreadystatechange = function() {
      r.readyState == 4 && (s ? this.IE_HACK ? e(BinaryToArray(r.responseBody).toArray()) : e(getBuffer(r.responseText)) : e(r.responseText));
    }, r.send("");
  }
  /** Flatten the data array as data attributes of elements of daplet */
  _applydata(t, e) {
    let s = 0;
    for (let i in e)
      e[i].type && (e[i].data = t[s++], e[i].type == "Structure" && this._applydata(e[i].data, e[i]));
  }
  /**
   * Load the dataset and call the callback with (data) where data is an array of data
   * the url must be a url with .dods extension.
   * @params:
   * - url (string): the url (must be a .dods url, it might have additonnal slicing OpENDAP query string)
   * - callback (function(data)): the callback which will receive parsed data.
   * - extraheaders (map/object) : Javascript Object or map that contains keys and values of additonnal headers for the request.
   */
  loadData(t, e, s, i) {
    this.proxyUrl(
      t,
      (a) => {
        let r = "";
        for (; !r.match(/\nData:\n$/); ) {
          let c = a.splice(0, 1);
          if (c.length === 0) throw new Error("Error reading data, are you sur this is a .dods request ?");
          r += String.fromCharCode(c);
        }
        r = r.substr(0, r.length - 7);
        let u = new ddsParser(r).parse(), o = new dapUnpacker(a, u).getValue();
        this._applydata(o, u), e(u);
      },
      !0,
      s,
      i
    );
  }
  /**
   * Load the dataset and call the callback with (dataset) where dataset is the dataset "metadata";
   * - url (string): the url (must be a bare OPeNDAP url, without "format extension" nor query parameters).
   * - callback (function(data)): the callback which will receive parsed data.
   * - extraheaders (map/object) : Javascript Object or map that contains keys and values of additonnal headers for the request.
   */
  loadDataset(t, e, s, i) {
    this.proxyUrl(
      t + ".dds",
      (a) => {
        let r = new ddsParser(a).parse();
        this.proxyUrl(
          t + ".das",
          function(u) {
            r = new dasParser(u, r).parse(), e(r);
          },
          !1,
          s,
          i
        );
      },
      !1,
      s,
      i
    );
  }
}
export {
  JsDap as default
};
