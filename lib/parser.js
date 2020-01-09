"use strict";

const atomicTypes = ["byte", "int", "uint", "int16", "uint16", "int32", "uint32", "float32", "float64", "string", "url", "alias"];
const structures = ["Sequence", "Structure", "Dataset"];
const IDENTIFIER_REGEX = "[\\w-/]";

Array.prototype.contains = function(item) {
    for (let i = 0, el = this[i]; i < this.length; el = this[++i]) {
        if (item == el) return true;
    }
    return false;
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
    if (/^[,:{}\[\]0-9.\-+Eaeflnr-u \n\r\t]*$/.test(str.replace(/\\./g, "@").replace(/"[^"\\\n\r]*"/g, ""))) {
        return eval("(" + str + ")");
    }
    return str;
}

class dapType {
    constructor(type) {
        this.type = type;
        this.attributes = {};
    }
}

class simpleParser {
    constructor(input) {
        this.stream = input;
    }

    peek(expr) {
        let regExp = new RegExp("^" + expr, "i");
        let m = this.stream.match(regExp);
        if (m) {
            return m[0];
        } else {
            return "";
        }
    }

    consume(expr) {
        let regExp = new RegExp("^" + expr, "i");
        // strip any unexpected line breaks to avoid error
        this.stream = this.stream.replace(/(?:\r\n|\r|\n)/g, "");
        this.stream = this.stream.replace(/\\/g, "/");
        let m = this.stream.match(regExp);
        if (m) {
            this.stream = this.stream.substr(m[0].length).ltrim();
            return m[0];
        } else {
            throw new Error("Unable to parse stream: " + this.stream.substr(0, 10));
        }
    }
}

export class ddsParser extends simpleParser {
    constructor(dds) {
        super(dds);
        this.dds = dds;
    }

    parse() {
        let dataset = new dapType("Dataset");

        this.consume("dataset");
        this.consume("{");
        while (!this.peek("}")) {
            let declaration = this._declaration();
            dataset[declaration.name] = declaration;
        }
        this.consume("}");

        dataset.id = dataset.name = this.consume("[^;]+");
        this.consume(";");

        // Set id.
        function walk(daplet, includeParent) {
            for (let attr in daplet) {
                let child = daplet[attr];
                if (child.type) {
                    child.id = child.name;
                    if (includeParent) {
                        child.id = daplet.id + "." + child.id;
                    }
                    walk(child, true);
                }
            }
        }

        walk(dataset, false);

        return dataset;
    }

    _declaration() {
        let type = this.peek(IDENTIFIER_REGEX + "+").toLowerCase();
        switch (type) {
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
        let baseType = new dapType();

        baseType.type = this.consume(IDENTIFIER_REGEX + "+");
        baseType.name = this.consume(IDENTIFIER_REGEX + "+");

        baseType.dimensions = [];
        baseType.shape = [];
        while (!this.peek(";")) {
            this.consume("\\[");
            let token = this.consume(IDENTIFIER_REGEX + "+");
            if (this.peek("=")) {
                baseType.dimensions.push(token);
                this.consume("=");
                token = this.consume("\\d+");
            }
            baseType.shape.push(parseInt(token));
            this.consume("\\]");
        }
        this.consume(";");

        return baseType;
    }

    _grid() {
        let grid = new dapType("Grid");

        this.consume("grid");
        this.consume("{");

        this.consume("array");
        this.consume(":");
        grid.array = this._base_declaration();

        this.consume("maps");
        this.consume(":");
        grid.maps = {};
        while (!this.peek("}")) {
            let map_ = this._base_declaration();
            grid.maps[map_.name] = map_;
        }
        this.consume("}");

        grid.name = this.consume(IDENTIFIER_REGEX + "+");
        this.consume(";");

        return grid;
    }

    _sequence() {
        let sequence = new dapType("Sequence");

        this.consume("sequence");
        this.consume("{");
        while (!this.peek("}")) {
            let declaration = this._declaration();
            sequence[declaration.name] = declaration;
        }
        this.consume("}");

        sequence.name = this.consume(IDENTIFIER_REGEX + "+");
        this.consume(";");

        return sequence;
    }

    _structure() {
        let structure = new dapType("Structure");

        this.consume("structure");
        this.consume("{");
        while (!this.peek("}")) {
            let declaration = this._declaration();
            structure[declaration.name] = declaration;
        }
        this.consume("}");

        structure.name = this.consume(IDENTIFIER_REGEX + "+");

        structure.dimensions = [];
        structure.shape = [];
        while (!this.peek(";")) {
            this.consume("\\[");
            let token = this.consume(IDENTIFIER_REGEX + "+");
            if (this.peek("=")) {
                structure.dimensions.push(token);
                this.consume("=");
                token = this.consume("\\d+");
            }
            structure.shape.push(parseInt(token));
            this.consume("\\]");
        }

        this.consume(";");

        return structure;
    }
}

export class dasParser extends simpleParser {
    constructor(das, dataset) {
        super(das);
        this.das = das;
        this.dataset = dataset;
    }

    parse() {
        this._target = this.dataset;

        this.consume("attributes");
        this.consume("{");
        while (!this.peek("}")) {
            this._attr_container();
        }
        this.consume("}");

        return this.dataset;
    }

    _attr_container() {
        if (atomicTypes.contains(this.peek(IDENTIFIER_REGEX + "+").toLowerCase())) {
            this._attribute(this._target.attributes);

            if (this._target.type == "Grid") {
                for (let map in this._target.maps) {
                    if (this.dataset[map]) {
                        let map = this._target.maps[map];
                        for (let name in map.attributes) {
                            this.dataset[map].attributes[name] = map.attributes[name];
                        }
                    }
                }
            }
        } else {
            this._container();
        }
    }

    _container() {
        let name = this.consume("[\\w-_\\./]+");
        this.consume("{");

        if (name.indexOf(".") > -1) {
            let names = name.split(".");
            let target = this._target;
            for (let i = 0; i < names.length; i++) {
                this._target = this._target[names[i]];
            }

            while (!this.peek("}")) {
                this._attr_container();
            }
            this.consume("}");

            this._target = target;
        } else if (structures.contains(this._target.type) && this._target[name]) {
            let target = this._target;
            this._target = target[name];

            while (!this.peek("}")) {
                this._attr_container();
            }
            this.consume("}");

            this._target = target;
        } else {
            this._target.attributes[name] = this._metadata();
            this.consume("}");
        }
    }

    _metadata() {
        let output = {};
        while (!this.peek("}")) {
            if (atomicTypes.contains(this.peek(IDENTIFIER_REGEX + "+").toLowerCase())) {
                this._attribute(output);
            } else {
                let name = this.consume(IDENTIFIER_REGEX + "+");
                this.consume("{");
                output[name] = this._metadata();
                this.consume("}");
            }
        }
        return output;
    }

    _attribute(object) {
        let type = this.consume(IDENTIFIER_REGEX + "+");
        let name = this.consume(IDENTIFIER_REGEX + "+");

        let values = [];
        while (!this.peek(";")) {
            let value = this.consume('".*?[^\\\\]"|[^;,]+');

            if (type.toLowerCase() == "string" || type.toLowerCase() == "url") {
                value = pseudoSafeEval(value);
            } else if (type.toLowerCase() == "alias") {
                let target, tokens;
                if (value.match(/^\\./)) {
                    tokens = value.substring(1).split(".");
                    target = this.dataset;
                } else {
                    tokens = value.split(".");
                    target = this._target;
                }

                for (let i = 0; i < tokens.length; i++) {
                    let token = tokens[i];
                    if (target[token]) {
                        target = target[token];
                    } else if (target.array.name == token) {
                        target = target.array;
                    } else if (target.maps[token]) {
                        target = target.maps[token];
                    } else {
                        target = target.attributes[token];
                    }
                    value = target;
                }
            } else {
                if (value.toLowerCase() == "nan") {
                    value = NaN;
                } else {
                    value = pseudoSafeEval(value);
                }
            }
            values.push(value);
            if (this.peek(",")) {
                this.consume(",");
            }
        }
        this.consume(";");

        if (values.length == 1) {
            values = values[0];
        }

        object[name] = values;
    }
}
