//#region ../node_modules/.pnpm/@scure+base@2.4.0/node_modules/@scure/base/index.js
/*! scure-base - MIT License (c) 2022 Paul Miller (paulmillr.com) */
const freeze = (fn) => Object.freeze(fn());
function isBytes(a) {
	return a instanceof Uint8Array || ArrayBuffer.isView(a) && a.constructor.name === "Uint8Array" && "BYTES_PER_ELEMENT" in a && a.BYTES_PER_ELEMENT === 1;
}
/** Asserts something is Uint8Array. */
function abytes(b) {
	if (!isBytes(b)) throw new TypeError("Uint8Array expected");
}
function isArrayOf(isString, arr) {
	if (!Array.isArray(arr)) return false;
	if (arr.length === 0) return true;
	if (isString) return arr.every((item) => typeof item === "string");
	else return arr.every((item) => Number.isSafeInteger(item));
}
function afn(input) {
	if (typeof input !== "function") throw new TypeError("function expected");
	return true;
}
function astr(label, input) {
	if (typeof input !== "string") throw new TypeError(`${label}: string expected`);
	return true;
}
function anumber(n, title = "number") {
	if (typeof n !== "number") throw new TypeError(`${title}: expected number, got ${typeof n}`);
	if (!Number.isSafeInteger(n)) throw new RangeError(`${title}: expected safe integer, got ${n}`);
}
function anumArr(label, input) {
	if (!isArrayOf(false, input)) throw new TypeError(`${label}: array of numbers expected`);
}
function chain(...args) {
	const id = (a) => a;
	const wrap = (a, b) => (c) => a(b(c));
	return {
		encode: args.map((x) => x.encode).reduceRight(wrap, id),
		decode: args.map((x) => x.decode).reduce(wrap, id)
	};
}
function normalize(fn) {
	afn(fn);
	return {
		encode: (from) => from,
		decode: (to) => fn(to)
	};
}
const powers = /* @__PURE__ */ (() => {
	let res = [];
	for (let i = 0; i < 40; i++) res.push(2 ** i);
	return res;
})();
function u8ToNumArr(u8, len = u8.length) {
	const res = new Array(len);
	for (let i = 0; i < len; i++) res[i] = u8[i];
	return res;
}
const asciiDecoder = /* @__PURE__ */ (() => {
	try {
		const decoder = new TextDecoder();
		return decoder.decode(Uint8Array.of(65, 48, 43, 127)) === "A0+" ? decoder : void 0;
	} catch (e) {
		return;
	}
})();
const B2S_CHUNK = 8192;
function charcodesToString(codes) {
	const len = codes.length;
	if (asciiDecoder !== void 0 && len >= 12) return asciiDecoder.decode(codes);
	if (len <= B2S_CHUNK) return String.fromCharCode.apply(null, codes);
	let res = "";
	for (let i = 0; i < len; i += B2S_CHUNK) res += String.fromCharCode.apply(null, codes.subarray(i, i + B2S_CHUNK));
	return res;
}
/**
* Linear 8 <-> bits regrouping (radix2Slow semantics), with Uint8Array digits and
* preallocated output.
*/
function radix2(bits) {
	anumber(bits);
	if (bits <= 0 || bits > 8) throw new RangeError("radix2: bits should be in (0..8]");
	const mask = powers[bits] - 1;
	return {
		encode: (bytes) => {
			abytes(bytes);
			const len = bytes.length;
			const res = new Uint8Array(Math.ceil(len * 8 / bits));
			let carry = 0;
			let pos = 0;
			let j = 0;
			for (let i = 0; i < len;) {
				if (i + 2 < len) {
					carry = carry << 24 | bytes[i] << 16 | bytes[i + 1] << 8 | bytes[i + 2];
					pos += 24;
					i += 3;
				} else {
					carry = (carry << 8 | bytes[i]) & 65535;
					pos += 8;
					i++;
				}
				for (;;) {
					pos -= bits;
					res[j++] = carry >> pos & mask;
					if (pos < bits) break;
				}
			}
			if (pos > 0) res[j] = carry << bits - pos & mask;
			return res;
		},
		decode: (digits) => {
			const len = digits.length;
			const res = new Uint8Array(Math.floor(len * bits / 8));
			let carry = 0;
			let pos = 0;
			let j = 0;
			for (let i = 0; i < len; i++) {
				carry = (carry << bits | digits[i]) & 65535;
				pos += bits;
				for (; pos >= 8; pos -= 8) res[j++] = carry >> pos - 8 & 255;
			}
			carry = carry << 8 - pos & 255;
			if (pos >= bits) throw new Error("Excess padding");
			if (carry > 0) throw new Error(`Non-zero padding: ${carry}`);
			return res;
		}
	};
}
/**
* Digit <-> letter mapping fused with string join (chain(alphabetSlow(letters), join(''))
* semantics), via char-code lookup tables.
*/
function alphabet(letters, aliases) {
	const len = letters.length;
	if (len > 128) throw new Error("alphabet: max 128 letters");
	const encTable = new Uint8Array(len);
	const decTable = (/* @__PURE__ */ new Int8Array(128)).fill(-1);
	for (let i = 0; i < len; i++) {
		const code = letters.charCodeAt(i);
		if (letters.codePointAt(i) !== code || code > 127) throw new Error("alphabet: single-char ASCII letters only");
		encTable[i] = code;
		decTable[code] = i;
	}
	if (aliases !== void 0) for (const alias of Object.keys(aliases)) {
		const code = alias.charCodeAt(0);
		const target = decTable[aliases[alias].charCodeAt(0)];
		if (alias.length !== 1 || code > 127 || target === void 0 || target === -1) throw new Error(`alphabet: invalid alias ${alias}`);
		decTable[code] = target;
	}
	return {
		encode: (digits) => {
			const codes = new Uint8Array(digits.length);
			for (let i = 0; i < digits.length; i++) {
				const d = digits[i];
				const code = encTable[d];
				if (code === void 0) throw new Error(`alphabet.encode: invalid digit ${d}`);
				codes[i] = code;
			}
			return charcodesToString(codes);
		},
		decode: (input) => {
			astr("decode", input);
			const slen = input.length;
			const digits = new Uint8Array(slen);
			for (let i = 0; i < slen; i++) {
				const code = input.charCodeAt(i);
				const digit = code < 128 ? decTable[code] : -1;
				if (digit === -1) throw new Error(`Unknown letter "${input[i]}". Allowed: ${letters}`);
				digits[i] = digit;
			}
			return digits;
		}
	};
}
function unsafeWrapper(fn) {
	afn(fn);
	return function(...args) {
		try {
			return fn.apply(null, args);
		} catch (e) {}
	};
}
const BECH_ALPHABET = /* @__PURE__ */ alphabet("qpzry9x8gf2tvdw0s3jn54khce6mua7l");
const BECH_UPPERCASE_PRINTABLE = /^[\x21-\x60\x7b-\x7e]+$/;
function assertBech32Printable(label, value) {
	for (let i = 0; i < value.length; i++) {
		const c = value.charCodeAt(i);
		if (c < 33 || c > 126) throw new Error(`${label}: printable ASCII expected`);
	}
}
function wordsToU8(words) {
	const len = words.length;
	const res = new Uint8Array(len);
	for (let i = 0; i < len; i++) {
		const w = words[i];
		if (w < 0 || w >= 32) throw new Error(`alphabet.encode: invalid digit ${w}`);
		res[i] = w;
	}
	return res;
}
const POLYMOD_GENERATORS = [
	996825010,
	642813549,
	513874426,
	1027748829,
	705979059
];
function bech32Polymod(pre) {
	const b = pre >> 25;
	let chk = (pre & 33554431) << 5;
	for (let i = 0; i < POLYMOD_GENERATORS.length; i++) if ((b >> i & 1) === 1) chk ^= POLYMOD_GENERATORS[i];
	return chk;
}
function bechChecksum(prefix, words, encodingConst = 1) {
	const len = prefix.length;
	let chk = 1;
	for (let i = 0; i < len; i++) {
		const c = prefix.charCodeAt(i);
		if (c < 33 || c > 126) throw new Error(`Invalid prefix (${prefix})`);
		chk = bech32Polymod(chk) ^ c >> 5;
	}
	chk = bech32Polymod(chk);
	for (let i = 0; i < len; i++) chk = bech32Polymod(chk) ^ prefix.charCodeAt(i) & 31;
	for (let v of words) chk = bech32Polymod(chk) ^ v;
	for (let i = 0; i < 6; i++) chk = bech32Polymod(chk);
	chk ^= encodingConst;
	const sum = /* @__PURE__ */ new Uint8Array(6);
	for (let i = 0; i < 6; i++) sum[i] = chk >>> 5 * (5 - i) & 31;
	return BECH_ALPHABET.encode(sum);
}
function genBech32(encoding) {
	const ENCODING_CONST = encoding === "bech32" ? 1 : 734539939;
	const _words = radix2(5);
	const toWords = (from) => {
		abytes(from);
		const len = from.length;
		const res = new Array(Math.ceil(len * 8 / 5));
		let carry = 0;
		let pos = 0;
		let j = 0;
		for (let i = 0; i < len; i++) {
			carry = carry << 8 | from[i];
			pos += 8;
			for (; pos >= 5; pos -= 5) res[j++] = carry >> pos - 5 & 31;
		}
		if (pos > 0) res[j] = carry << 5 - pos & 31;
		return res;
	};
	const fromWords = (to) => {
		anumArr("radix2.decode", to);
		const len = to.length;
		const digits = new Uint8Array(len);
		for (let i = 0; i < len; i++) {
			const w = to[i];
			if (w < 0 || w >= 32) throw new Error(`convertRadix2: invalid word=${w}`);
			digits[i] = w;
		}
		return _words.decode(digits);
	};
	const fromWordsUnsafe = unsafeWrapper(fromWords);
	function encode(prefix, words, limit = 90) {
		astr("bech32.encode prefix", prefix);
		if (limit !== false) anumber(limit, "limit");
		if (isBytes(words)) words = u8ToNumArr(words);
		anumArr("bech32.encode", words);
		const plen = prefix.length;
		if (plen === 0) throw new TypeError(`Invalid prefix length ${plen}`);
		const actualLength = plen + 7 + words.length;
		if (limit !== false && actualLength > limit) throw new TypeError(`Length ${actualLength} exceeds limit ${limit}`);
		assertBech32Printable("bech32.encode prefix", prefix);
		const lowered = prefix.toLowerCase();
		const sum = bechChecksum(lowered, words, ENCODING_CONST);
		return `${lowered}1${BECH_ALPHABET.encode(wordsToU8(words))}${sum}`;
	}
	function decode(str, limit = 90) {
		astr("bech32.decode input", str);
		if (limit !== false) anumber(limit, "limit");
		const slen = str.length;
		if (slen < 8 || limit !== false && slen > limit) throw new TypeError(`invalid string length ${slen}, expected (8..${limit})`);
		const lowered = str.toLowerCase();
		if (str !== lowered) {
			if (!BECH_UPPERCASE_PRINTABLE.test(str)) {
				assertBech32Printable("bech32.decode input", str);
				throw new Error(`mixed-case string not allowed`);
			}
		}
		const sepIndex = lowered.lastIndexOf("1");
		if (sepIndex === 0 || sepIndex === -1) throw new Error(`invalid separator "1"`);
		const prefix = lowered.slice(0, sepIndex);
		const data = lowered.slice(sepIndex + 1);
		if (data.length < 6) throw new Error("invalid data length");
		const digits = BECH_ALPHABET.decode(data);
		const words = u8ToNumArr(digits, digits.length - 6);
		const sum = bechChecksum(prefix, words, ENCODING_CONST);
		if (!data.endsWith(sum)) throw new Error(`Invalid checksum in ${str}`);
		return {
			prefix,
			words
		};
	}
	const decodeUnsafe = unsafeWrapper(decode);
	function decodeToBytes(str, limit = 90) {
		const { prefix, words } = decode(str, limit);
		return {
			prefix,
			words,
			bytes: fromWords(words)
		};
	}
	function encodeFromBytes(prefix, bytes) {
		return encode(prefix, toWords(bytes));
	}
	return {
		encode,
		decode,
		encodeFromBytes,
		decodeToBytes,
		decodeUnsafe,
		fromWords,
		fromWordsUnsafe,
		toWords
	};
}
/**
* bech32 from BIP 173. Operates on words.
* For high-level helpers, check out {@link https://github.com/paulmillr/scure-btc-signer | scure-btc-signer}.
* @example
* Convert bytes to words, encode them, then decode back.
* ```ts
* const words = bech32.toWords(Uint8Array.from([1, 2, 3]));
* const text = bech32.encode('bc', words);
* bech32.decode(text);
* ```
*/
const bech32 = /* @__PURE__ */ freeze(() => genBech32("bech32"));
const _isWellFormedShim = (str) => {
	try {
		return encodeURI(str) !== null;
	} catch {
		return false;
	}
};
const _isWellFormed = /* @__PURE__ */ (() => typeof "".isWellFormed === "function" ? (str) => str.isWellFormed() : _isWellFormedShim)();
const utf8err = (i) => /* @__PURE__ */ new TypeError(`invalid utf8 at byte ${i}`);
const utf8Fallback = /* @__PURE__ */ freeze(() => ({
	encode(data) {
		abytes(data);
		let res = "";
		for (let i = 0; i < data.length;) {
			const a = data[i++];
			if (a < 128) {
				res += String.fromCharCode(a);
				continue;
			}
			if (a < 194 || i >= data.length) throw utf8err(i - 1);
			const b = data[i++];
			if ((b & 192) !== 128) throw utf8err(i - 1);
			let cp = (a & 31) << 6 | b & 63;
			if (a >= 224) {
				if (i >= data.length) throw utf8err(i - 1);
				const c = data[i++];
				if ((c & 192) !== 128 || a === 224 && b < 160 || a === 237 && b >= 160) throw utf8err(i - 1);
				cp = (a & 15) << 12 | (b & 63) << 6 | c & 63;
				if (a >= 240) {
					if (i >= data.length) throw utf8err(i - 1);
					const d = data[i++];
					if (a > 244 || (d & 192) !== 128 || a === 240 && b < 144 || a === 244 && b >= 144) throw utf8err(i - 1);
					cp = (a & 7) << 18 | (b & 63) << 12 | (c & 63) << 6 | d & 63;
				}
			}
			if (cp < 65536) res += String.fromCharCode(cp);
			else {
				cp -= 65536;
				res += String.fromCharCode((cp >> 10) + 55296, (cp & 1023) + 56320);
			}
		}
		return res;
	},
	decode(str) {
		astr("utf8", str);
		if (!_isWellFormed(str)) throw new TypeError("utf8 expected well-formed string");
		const res = new Uint8Array(str.length * 3);
		let pos = 0;
		for (let i = 0; i < str.length; i++) {
			let c = str.charCodeAt(i);
			if (c < 128) {
				res[pos++] = c;
				continue;
			}
			if (c >= 55296 && c <= 57343) {
				const d = str.charCodeAt(++i);
				c = 65536 + (c - 55296 << 10) + d - 56320;
			}
			if (c >= 65536) {
				res[pos++] = c >> 18 | 240;
				res[pos++] = c >> 12 & 63 | 128;
			} else if (c >= 2048) res[pos++] = c >> 12 | 224;
			else res[pos++] = c >> 6 | 192;
			if (c >= 2048) res[pos++] = c >> 6 & 63 | 128;
			res[pos++] = c & 63 | 128;
		}
		return res.subarray(0, pos);
	}
}));
/**
* Strict UTF-8-to-byte decoder. Uses built-in TextDecoder / TextEncoder when available.
* Method names follow `BytesCoder`, so `encode(bytes)` returns a string and
* `decode(string)` returns bytes.
* `encode(bytes)` requires Uint8Array input, preserves an explicit leading BOM, and
*   throws on invalid UTF-8 bytes.
* `decode(string)` requires a primitive string and throws on malformed UTF-16 strings with
*   lone surrogates.
* @example
* ```js
* const b = utf8.decode("hey"); // => new Uint8Array([ 104, 101, 121 ])
* const str = utf8.encode(b); // "hey"
* ```
*/
const utf8 = /* @__PURE__ */ freeze(() => {
	let _utf8Encoder;
	let _utf8Decoder;
	const utf8Builtin = {
		encode(data) {
			abytes(data);
			return (_utf8Decoder || (_utf8Decoder = new TextDecoder("utf-8", {
				ignoreBOM: true,
				fatal: true
			}))).decode(data);
		},
		decode(str) {
			astr("utf8", str);
			if (!_isWellFormed(str)) throw new TypeError("utf8 expected well-formed string");
			return (_utf8Encoder || (_utf8Encoder = new TextEncoder())).encode(str);
		}
	};
	return {
		encode: typeof TextDecoder === "function" ? utf8Builtin.encode : utf8Fallback.encode,
		decode: typeof TextEncoder === "function" ? utf8Builtin.decode : utf8Fallback.decode
	};
});
/** Lowercase hex with case-insensitive decoding. Pure JS version. */
const hexFallback = /* @__PURE__ */ freeze(() => chain(radix2(4), alphabet("0123456789abcdef", {
	A: "a",
	B: "b",
	C: "c",
	D: "d",
	E: "e",
	F: "f"
}), normalize((s) => {
	astr("hex", s);
	if (s.length % 2 !== 0) throw new TypeError(`hex.decode: odd-length string (${s.length})`);
	return s;
})));
const hasHexBuiltin = /* @__PURE__ */ (() => typeof Uint8Array.from([]).toHex === "function" && typeof Uint8Array.fromHex === "function")();
const hexBuiltin = {
	encode(data) {
		abytes(data);
		return data.toHex();
	},
	decode(s) {
		astr("hex", s);
		return Uint8Array.fromHex(s);
	}
};
/**
* hex string decoder. Uses built-in function, when available.
* Lowercase codec; unlike `base16`, this variant accepts either hex case and emits lowercase.
* @example
* ```js
* const b = hex.decode("0102ff"); // => new Uint8Array([ 1, 2, 255 ])
* const str = hex.encode(b); // "0102ff"
* ```
*/
const hex = /* @__PURE__ */ freeze(() => hasHexBuiltin ? hexBuiltin : hexFallback);
//#endregion
//#region ../bolt11.js
/**
*
* @typedef {{bech32: string, pubKeyHash: number, scriptHash: number, validWitnessVersions: number[]}} Network
*
* @typedef {{
*   name: 'coin_network',
*   letters: string,
*   value?: Network
* }} NetworkSection
*
* @typedef {{
*   option_data_loss_protect: string,
*   initial_routing_sync: string,
*   option_upfront_shutdown_script: string,
*   gossip_queries: string,
*   var_onion_optin: string,
*   gossip_queries_ex: string,
*   option_static_remotekey: string,
*   payment_secret: string,
*   basic_mpp: string,
*   option_support_large_channel: string,
*   extra_bits: {
*     start_bit: number,
*     bits: unknown[],
*     has_required: boolean
*   }
* }} FeatureBits
*
* @typedef {{ pubkey: string, short_channel_id: string, fee_base_msat: number, fee_proportional_millionths: number, cltv_expiry_delta: number }} RouteHint
* @typedef {{ name: "route_hint", tag: "r", letters: string, value: RouteHint[] }} RouteHintSection
* @typedef {{ name: "feature_bits", tag: "9", letters: string, value: FeatureBits }} FeatureBitsSection
*
* @typedef {
*   | { name: "paymentRequest", value: string }
*   | { name: "expiry", value: number }
*   | { name: "checksum", letters: string }
*   | NetworkSection
*   | { name: "amount", letters: string; value: string }
*   | { name: "separator", letters: string }
*   | { name: "timestamp", letters: string, value: number }
*   | { name: "payment_hash", tag: "p", letters: string, value: string }
*   | { name: "description", tag: "d", letters: string, value: string }
*   | { name: "payment_secret", tag: "s", letters: string, value: string }
*   | {
*       name: "min_final_cltv_expiry",
*       tag: "c",
*       letters: string,
*       value: number
*     }
*   | FeatureBitsSection
*   | RouteHintSection
*   | { name: "signature", letters: string, value: string }
*   | { name: "lightning_network", letters: string }
*   } Section
*
* @typedef {{ paymentRequest: string, sections: Section[], expiry: number, route_hints: RouteHint[][] }} DecodedInvoice
*
*/
/** @type {Network} */
const DEFAULTNETWORK = {
	bech32: "bc",
	pubKeyHash: 0,
	scriptHash: 5,
	validWitnessVersions: [0]
};
/** @type {Network} */
const TESTNETWORK = {
	bech32: "tb",
	pubKeyHash: 111,
	scriptHash: 196,
	validWitnessVersions: [0]
};
/** @type {Network} */
const SIGNETNETWORK = {
	bech32: "tbs",
	pubKeyHash: 111,
	scriptHash: 196,
	validWitnessVersions: [0]
};
/** @type {Network} */
const REGTESTNETWORK = {
	bech32: "bcrt",
	pubKeyHash: 111,
	scriptHash: 196,
	validWitnessVersions: [0]
};
/** @type {Network} */
const SIMNETWORK = {
	bech32: "sb",
	pubKeyHash: 63,
	scriptHash: 123,
	validWitnessVersions: [0]
};
/** @type {string[]} */
const FEATUREBIT_ORDER = [
	"option_data_loss_protect",
	"initial_routing_sync",
	"option_upfront_shutdown_script",
	"gossip_queries",
	"var_onion_optin",
	"gossip_queries_ex",
	"option_static_remotekey",
	"payment_secret",
	"basic_mpp",
	"option_support_large_channel"
];
const DIVISORS = {
	m: BigInt(1e3),
	u: BigInt(1e6),
	n: BigInt(1e9),
	p: BigInt(0xe8d4a51000)
};
const MAX_MILLISATS = BigInt("2100000000000000000");
const MILLISATS_PER_BTC = BigInt(1e11);
const TAGCODES = {
	payment_hash: 1,
	payment_secret: 16,
	description: 13,
	payee: 19,
	description_hash: 23,
	expiry: 6,
	min_final_cltv_expiry: 24,
	fallback_address: 9,
	route_hint: 3,
	feature_bits: 5,
	metadata: 27
};
const TAGNAMES = {};
for (let i = 0, keys = Object.keys(TAGCODES); i < keys.length; i++) {
	const currentName = keys[i];
	const currentCode = TAGCODES[keys[i]].toString();
	TAGNAMES[currentCode] = currentName;
}
const TAGPARSERS = {
	1: (words) => hex.encode(bech32.fromWordsUnsafe(words)),
	16: (words) => hex.encode(bech32.fromWordsUnsafe(words)),
	13: (words) => utf8.encode(bech32.fromWordsUnsafe(words)),
	19: (words) => hex.encode(bech32.fromWordsUnsafe(words)),
	23: (words) => hex.encode(bech32.fromWordsUnsafe(words)),
	27: (words) => hex.encode(bech32.fromWordsUnsafe(words)),
	6: wordsToIntBE,
	24: wordsToIntBE,
	3: routingInfoParser,
	5: featureBitsParser
};
/**
*
* @param {string} tagCode
* @returns {function(*): {tagCode: number, words: `unknown1${string}`}}
*/
function getUnknownParser(tagCode) {
	return (words) => ({
		tagCode: Number.parseInt(tagCode),
		words: bech32.encode("unknown", words, Number.MAX_SAFE_INTEGER)
	});
}
/**
*
* @param {number[]} words
* @returns {*}
*/
function wordsToIntBE(words) {
	return words.toReversed().reduce((total, item, index) => total + item * 32 ** index, 0);
}
/**
* First convert from words to buffer, trimming padding where necessary
* parse in 51 byte chunks. See encoder for details.
* @param {number[]} words
* @returns {*[]}
*/
function routingInfoParser(words) {
	const routes = [];
	let pubkey;
	let shortChannelId;
	let feeBaseMSats;
	let feeProportionalMillionths;
	let cltvExpiryDelta;
	let routesBuffer = bech32.fromWordsUnsafe(words);
	while (routesBuffer.length > 0) {
		pubkey = hex.encode(routesBuffer.slice(0, 33));
		shortChannelId = hex.encode(routesBuffer.slice(33, 41));
		feeBaseMSats = Number.parseInt(hex.encode(routesBuffer.slice(41, 45)), 16);
		feeProportionalMillionths = Number.parseInt(hex.encode(routesBuffer.slice(45, 49)), 16);
		cltvExpiryDelta = Number.parseInt(hex.encode(routesBuffer.slice(49, 51)), 16);
		routesBuffer = routesBuffer.slice(51);
		routes.push({
			pubkey,
			short_channel_id: shortChannelId,
			fee_base_msat: feeBaseMSats,
			fee_proportional_millionths: feeProportionalMillionths,
			cltv_expiry_delta: cltvExpiryDelta
		});
	}
	return routes;
}
/**
*
* @param {Uint8Array} words
* @returns {{}}
*/
function featureBitsParser(words) {
	const bools = words.slice().toReversed().map((word) => [
		Boolean(word & 1),
		Boolean(word & 2),
		Boolean(word & 4),
		Boolean(word & 8),
		Boolean(word & 16)
	]).reduce((finalArr, itemArr) => finalArr.concat(itemArr), []);
	while (bools.length < FEATUREBIT_ORDER.length * 2) bools.push(false);
	const featureBits = {};
	for (const featureName of FEATUREBIT_ORDER) {
		const index = FEATUREBIT_ORDER.indexOf(featureName);
		let status;
		if (bools[index * 2]) status = "required";
		else if (bools[index * 2 + 1]) status = "supported";
		else status = "unsupported";
		featureBits[featureName] = status;
	}
	const extraBits = bools.slice(FEATUREBIT_ORDER.length * 2);
	featureBits.extra_bits = {
		start_bit: FEATUREBIT_ORDER.length * 2,
		bits: extraBits,
		has_required: extraBits.reduce((result, bit, index) => index % 2 === 0 ? result || bit : result || false, false)
	};
	return featureBits;
}
/**
*
* @param {string} hrpString
* @param {boolean} outputString
* @returns {string|bigint}
*/
function hrpToMillisat(hrpString, outputString) {
	let divisor, value;
	if (/^[munp]$/.test(hrpString.slice(-1))) {
		divisor = hrpString.slice(-1);
		value = hrpString.slice(0, -1);
	} else if (/^[^munp0-9]$/.test(hrpString.slice(-1))) throw new Error("Not a valid multiplier for the amount");
	else value = hrpString;
	if (!/^\d+$/.test(value)) throw new Error("Not a valid human readable amount");
	const valueBN = BigInt(value);
	const millisatoshisBN = divisor ? valueBN * MILLISATS_PER_BTC / DIVISORS[divisor] : valueBN * MILLISATS_PER_BTC;
	if (divisor === "p" && !(valueBN % BigInt(10) === BigInt(0)) || millisatoshisBN > MAX_MILLISATS) throw new Error("Amount is outside of valid range");
	return outputString ? millisatoshisBN.toString() : millisatoshisBN;
}
/**
* Decode will only have extra comments that aren't covered in encode comments.
* Also, if anything is hard to read I'll comment.
* @param {string} paymentRequest
* @param {Network=} network
* @returns {DecodedInvoice}
*/
function decode(paymentRequest, network) {
	if (typeof paymentRequest !== "string") throw new Error("Lightning Payment Request must be string");
	if (paymentRequest.slice(0, 2).toLowerCase() !== "ln") throw new Error("Not a proper lightning payment request");
	/** @type {Section[]} */
	const sections = [];
	const decoded = bech32.decode(paymentRequest, Number.MAX_SAFE_INTEGER);
	const paymentRequest_lower = paymentRequest.toLowerCase();
	const prefix = decoded.prefix;
	let words = decoded.words;
	let letters = paymentRequest_lower.slice(prefix.length + 1);
	let sigWords = words.slice(-104);
	words = words.slice(0, -104);
	let prefixMatches = prefix.match(/^ln(\S+?)(\d*)([a-zA-Z]?)$/);
	if (prefixMatches && !prefixMatches[2]) prefixMatches = prefix.match(/^ln(\S+)$/);
	if (!prefixMatches) throw new Error("Not a proper lightning payment request");
	sections.push({
		name: "lightning_network",
		letters: "ln"
	});
	const bech32Prefix = prefixMatches[1];
	let coinNetwork;
	if (network) {
		if (network.bech32 === void 0 || network.pubKeyHash === void 0 || network.scriptHash === void 0 || !Array.isArray(network.validWitnessVersions)) throw new Error("Invalid network");
		coinNetwork = network;
	} else switch (bech32Prefix) {
		case DEFAULTNETWORK.bech32:
			coinNetwork = DEFAULTNETWORK;
			break;
		case TESTNETWORK.bech32:
			coinNetwork = TESTNETWORK;
			break;
		case SIGNETNETWORK.bech32:
			coinNetwork = SIGNETNETWORK;
			break;
		case REGTESTNETWORK.bech32:
			coinNetwork = REGTESTNETWORK;
			break;
		case SIMNETWORK.bech32: coinNetwork = SIMNETWORK;
	}
	if (!coinNetwork || coinNetwork.bech32 !== bech32Prefix) throw new Error("Unknown coin bech32 prefix");
	sections.push({
		name: "coin_network",
		letters: bech32Prefix,
		value: coinNetwork
	});
	const value = prefixMatches[2];
	let millisatoshis;
	if (value) {
		const divisor = prefixMatches[3];
		millisatoshis = hrpToMillisat(value + divisor, true);
		sections.push({
			name: "amount",
			letters: prefixMatches[2] + prefixMatches[3],
			value: millisatoshis
		});
	} else millisatoshis = null;
	sections.push({
		name: "separator",
		letters: "1"
	});
	const timestamp = wordsToIntBE(words.slice(0, 7));
	words = words.slice(7);
	sections.push({
		name: "timestamp",
		letters: letters.slice(0, 7),
		value: timestamp
	});
	letters = letters.slice(7);
	let tagName;
	let parser;
	let tagLength;
	let tagWords;
	while (words.length > 0) {
		const tagCode = words[0].toString();
		tagName = TAGNAMES[tagCode] || "unknown_tag";
		parser = TAGPARSERS[tagCode] || getUnknownParser(tagCode);
		words = words.slice(1);
		tagLength = wordsToIntBE(words.slice(0, 2));
		words = words.slice(2);
		tagWords = words.slice(0, tagLength);
		words = words.slice(tagLength);
		sections.push({
			name: tagName,
			tag: letters[0],
			letters: letters.slice(0, 3 + tagLength),
			value: parser(tagWords)
		});
		letters = letters.slice(3 + tagLength);
	}
	sections.push({
		name: "signature",
		letters: letters.slice(0, 104),
		value: hex.encode(bech32.fromWordsUnsafe(sigWords))
	});
	letters = letters.slice(104);
	sections.push({
		name: "checksum",
		letters
	});
	let result = {
		paymentRequest,
		sections,
		get expiry() {
			let exp = sections.find((s) => s.name === "expiry");
			if (exp) return getValue("timestamp") + exp.value;
		},
		get route_hints() {
			return sections.filter((s) => s.name === "route_hint").map((s) => s.value);
		}
	};
	for (let name in TAGCODES) {
		if (name === "route_hint") continue;
		Object.defineProperty(result, name, { get() {
			return getValue(name);
		} });
	}
	return result;
	/**
	*
	* @param {string} name
	* @returns {*|undefined}
	*/
	function getValue(name) {
		let section = sections.find((s) => s.name === name);
		return section ? section.value : void 0;
	}
}
//#endregion
//#region example.js
const TAGCOLORS = {
	lightning_network: "rgb(31, 31, 40)",
	coin_network: "rgb(27, 51, 93)",
	amount: "rgb(0, 110, 98)",
	separator: "rgb(31, 31, 40)",
	timestamp: "rgb(181, 10, 11)",
	payment_hash: "rgb(71, 105, 169)",
	description: "rgb(41, 131, 11)",
	description_hash: "rgb(41, 131, 11)",
	payment_secret: "rgb(92, 25, 75)",
	expiry: "rgb(181, 10, 11)",
	metadata: "rgb(86, 25, 24)",
	feature_bits: "rgb(57, 118, 179)",
	payee: "rgb(51, 44, 138)",
	unknown_tag: "rgb(37, 15, 45)",
	min_final_cltv_expiry: "rgb(119, 34, 32)",
	fallback_address: "rgb(27, 51, 93)",
	route_hint: "rgb(131, 93, 233)",
	signature: "rgb(51, 44, 138)",
	checksum: "rgb(31, 31, 40)"
};
function getTagColor(name) {
	return TAGCOLORS[name] || "rgb(0, 0, 0)";
}
function start() {
	const pr = "lnbc20u1p3y0x3hpp5743k2g0fsqqxj7n8qzuhns5gmkk4djeejk3wkp64ppevgekvc0jsdqcve5kzar2v9nr5gpqd4hkuetesp5ez2g297jduwc20t6lmqlsg3man0vf2jfd8ar9fh8fhn2g8yttfkqxqy9gcqcqzys9qrsgqrzjqtx3k77yrrav9hye7zar2rtqlfkytl094dsp0ms5majzth6gt7ca6uhdkxl983uywgqqqqlgqqqvx5qqjqrzjqd98kxkpyw0l9tyy8r8q57k7zpy9zjmh6sez752wj6gcumqnj3yxzhdsmg6qq56utgqqqqqqqqqqqeqqjq7jd56882gtxhrjm03c93aacyfy306m4fq0tskf83c0nmet8zc2lxyyg3saz8x6vwcp26xnrlagf9semau3qm2glysp7sv95693fphvsp54l567";
	const textInputTextarea = document.querySelector("#textInput");
	textInputTextarea.value = pr;
	textInputTextarea.addEventListener("change", () => {
		setPR(textInputTextarea.value);
		console.log("changed");
	});
	setPR(pr);
}
function setColor(element, sectionName) {
	element.style.color = "black";
	element.style.backgroundColor = getTagColor(sectionName).replace("rgb", "rgba").replace(")", ", 0.2)");
}
function setHighlight(element, sectionName) {
	element.style.color = "white";
	element.style.backgroundColor = getTagColor(sectionName);
}
function newSpan(section) {
	const sectionSpan = document.createElement("span");
	sectionSpan.textContent = section.letters;
	sectionSpan.style.fontFamily = "monospace";
	sectionSpan.style.fontSize = "25px";
	setColor(sectionSpan, section.name);
	sectionSpan.addEventListener("mouseenter", () => {
		setHighlight(sectionSpan, section.name);
		setInfo(section);
	});
	sectionSpan.addEventListener("mouseleave", () => {
		setColor(sectionSpan, section.name);
		clearInfo();
	});
	return sectionSpan;
}
function setInfo(section) {
	const infoDiv = document.querySelector("#info");
	infoDiv.innerHTML = "";
	infoDiv.style.backgroundColor = getTagColor(section.name);
	infoDiv.style.display = "block";
	const name = document.createElement("div");
	name.textContent = `name: ${section.name}`;
	infoDiv.append(name);
	if (section.tag) {
		const tag = document.createElement("div");
		tag.textContent = `tag: ${section.tag}`;
		infoDiv.append(tag);
	}
	const tag = document.createElement("div");
	tag.textContent = `tag: ${JSON.stringify(section.value)}`;
	infoDiv.append(tag);
}
function clearInfo() {
	const infoDiv = document.querySelector("#info");
	infoDiv.style.display = "none";
}
function setPR(pr) {
	const parsed = decode(pr);
	const decodedDiv = document.querySelector("#decoded");
	decodedDiv.innerHTML = "";
	for (const section of parsed.sections) decodedDiv.append(newSpan(section));
}
//#endregion
export { setPR, start };
