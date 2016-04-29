'use strict';

/**
 * TSSprintf
 */
export class TSSprintf {
    
    private static re = {
        not_string: /[^s]/,
        not_bool: /[^t]/,
        not_type: /[^T]/,
        not_primitive: /[^v]/,
        number: /[diefg]/,
        numeric_arg: /bcdiefguxX/,
        json: /[j]/,
        not_json: /[^j]/,
        text: /^[^\x25]+/,
        modulo: /^\x25{2}/,
        placeholder: /^\x25(?:([1-9]\d*)\$|\(([^\)]+)\))?(\+)?(0|'[^$])?(-)?(\d+)?(?:\.(\d+))?([b-gijostTuvxX])/,
        key: /^([a-z_][a-z_\d]*)/i,
        key_access: /^\.([a-z_][a-z_\d]*)/i,
        index_access: /^\[(\d+)\]/,
        sign: /^[\+\-]/
    };
    
    private static preformattedPadding = {
        '0': ['', '0', '00', '000', '0000', '00000', '000000', '0000000'],
        ' ': ['', ' ', '  ', '   ', '    ', '     ', '      ', '       '],
        '_': ['', '_', '__', '___', '____', '_____', '______', '_______'],
    };
    
    private static cache = {}
    
    constructor() {
    }
    
    public static sprintf(format: string, ...args: any[]): string {
        var key = format, cache = this.cache;
        
        if (!(cache[key] && cache.hasOwnProperty(key))) {
            cache[key] = this.parse(key);
        }
        return this.format(cache[key], args);
    }
    
    private static format(parse_tree, argv) {
        var cursor = 0, tree_length = parse_tree.length, node_type = '', arg, output = [], i, k, match, pad, pad_character, pad_length, is_positive = true, sign = '';
        for (i = 0; i < tree_length; i++) {
            node_type = this.get_type(parse_tree[i]);
            if (node_type === 'string') {
                output[output.length] = parse_tree[i];
            }
            else if (node_type === 'array') {
                match = parse_tree[i]; // convenience purposes only
                if (match[2]) {
                    arg = argv[cursor];
                    for (k = 0; k < match[2].length; k++) {
                        if (!arg.hasOwnProperty(match[2][k])) {
                            throw new Error(TSSprintf.sprintf('[sprintf] property "%s" does not exist', match[2][k]));
                        }
                        arg = arg[match[2][k]];
                    }
                }
                else if (match[1]) {
                    arg = argv[match[1]];
                }
                else {
                    arg = argv[cursor++];
                }
                if (this.re.not_type.test(match[8]) && this.re.not_primitive.test(match[8]) && this.get_type(arg) == 'function') {
                    arg = arg();
                }
                if (this.re.numeric_arg.test(match[8]) && (this.get_type(arg) != 'number' && isNaN(arg))) {
                    throw new TypeError(TSSprintf.sprintf("[sprintf] expecting number but found %s", this.get_type(arg)));
                }
                if (this.re.number.test(match[8])) {
                    is_positive = arg >= 0;
                }
                switch (match[8]) {
                    case 'b':
                        arg = parseInt(arg, 10).toString(2);
                        break;
                    case 'c':
                        arg = String.fromCharCode(parseInt(arg, 10));
                        break;
                    case 'd':
                    case 'i':
                        arg = parseInt(arg, 10);
                        break;
                    case 'j':
                        arg = JSON.stringify(arg, null, match[6] ? parseInt(match[6]) : 0);
                        break;
                    case 'e':
                        arg = match[7] ? parseFloat(arg).toExponential(match[7]) : parseFloat(arg).toExponential();
                        break;
                    case 'f':
                        arg = match[7] ? parseFloat(arg).toFixed(match[7]) : parseFloat(arg);
                        break;
                    case 'g':
                        arg = match[7] ? parseFloat(arg).toPrecision(match[7]) : parseFloat(arg);
                        break;
                    case 'o':
                        arg = arg.toString(8);
                        break;
                    case 's':
                        arg = String(arg);
                        arg = (match[7] ? arg.substring(0, match[7]) : arg);
                        break;
                    case 't':
                        arg = String(!!arg);
                        arg = (match[7] ? arg.substring(0, match[7]) : arg);
                        break;
                    case 'T':
                        arg = this.get_type(arg);
                        arg = (match[7] ? arg.substring(0, match[7]) : arg);
                        break;
                    case 'u':
                        arg = parseInt(arg, 10) >>> 0;
                        break;
                    case 'v':
                        arg = arg.valueOf();
                        arg = (match[7] ? arg.substring(0, match[7]) : arg);
                        break;
                    case 'x':
                        arg = parseInt(arg, 10).toString(16);
                        break;
                    case 'X':
                        arg = parseInt(arg, 10).toString(16).toUpperCase();
                        break;
                }
                if (this.re.json.test(match[8])) {
                    output[output.length] = arg;
                }
                else {
                    if (this.re.number.test(match[8]) && (!is_positive || match[3])) {
                        sign = is_positive ? '+' : '-';
                        arg = arg.toString().replace(this.re.sign, '');
                    }
                    else {
                        sign = '';
                    }
                    pad_character = match[4] ? match[4] === '0' ? '0' : match[4].charAt(1) : ' ';
                    pad_length = match[6] - (sign + arg).length;
                    pad = match[6] ? (pad_length > 0 ? this.str_repeat(pad_character, pad_length) : '') : '';
                    output[output.length] = match[5] ? sign + arg + pad : (pad_character === '0' ? sign + pad + arg : pad + sign + arg);
                }
            }
        }
        return output.join('');
    }
    
    private static parse(fmt){
        var _fmt = fmt, match = [], parse_tree = [], arg_names = 0;
        while (_fmt) {
            if ((match = this.re.text.exec(_fmt)) !== null) {
                parse_tree[parse_tree.length] = match[0];
            }
            else if ((match = this.re.modulo.exec(_fmt)) !== null) {
                parse_tree[parse_tree.length] = '%';
            }
            else if ((match = this.re.placeholder.exec(_fmt)) !== null) {
                if (match[2]) {
                    arg_names |= 1;
                    var field_list = [], replacement_field = match[2], field_match = [];
                    if ((field_match = this.re.key.exec(replacement_field)) !== null) {
                        field_list[field_list.length] = field_match[1];
                        while ((replacement_field = replacement_field.substring(field_match[0].length)) !== '') {
                            if ((field_match = this.re.key_access.exec(replacement_field)) !== null) {
                                field_list[field_list.length] = field_match[1];
                            }
                            else if ((field_match = this.re.index_access.exec(replacement_field)) !== null) {
                                field_list[field_list.length] = field_match[1];
                            }
                            else {
                                throw new SyntaxError("[sprintf] failed to parse named argument key");
                            }
                        }
                    }
                    else {
                        throw new SyntaxError("[sprintf] failed to parse named argument key");
                    }
                    match[2] = field_list;
                }
                else {
                    arg_names |= 2;
                }
                if (arg_names === 3) {
                    throw new Error("[sprintf] mixing positional and named placeholders is not (yet) supported");
                }
                parse_tree[parse_tree.length] = match;
            }
            else {
                throw new SyntaxError("[sprintf] unexpected placeholder");
            }
            _fmt = _fmt.substring(match[0].length);
        }
        return parse_tree;
    }
    
    private static get_type(variable){
        if (typeof variable === 'number') {
            return 'number';
        }
        else if (typeof variable === 'string') {
            return 'string';
        }
        else {
            return Object.prototype.toString.call(variable).slice(8, -1).toLowerCase();
        }
    }
    
    private static str_repeat(input, multiplier) {
        if (multiplier >= 0 && multiplier <= 7 && this.preformattedPadding[input]) {
            return this.preformattedPadding[input][multiplier];
        }
        return Array(multiplier + 1).join(input);
    }
}