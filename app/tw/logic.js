/**
 * Created by Administrator on 2016/9/19.
 */
'use strict';
var _ = require('lodash');

var all_type = {
	'QL': 5,
	'YTL': 4,
	'LDB': 3,
	'SSZ': 2,
	'STH': 1
};

/**
 * 检测清龙
 */
var checkQL = function (cards) {
	var hs = _.uniq(_.map(cards, function (n) { return parseInt(n / 100) }));
	if (hs.length > 1) return false;
	if (!checkYTL(cards)) return false;
	return true;
}

/**
 * 检测清一色
 */
var checkQYS = function (cards) {
	var hs = _.uniq(_.map(cards, function (n) { return parseInt(n / 100) }));
	if (hs.length > 1) return false;
	return true;
}

/**
 * 检测一条龙
 */
var checkYTL = function (cards) {
	var ps = _.uniq(_.map(cards, function (n) { return n % 100 }));
	if (ps.length < 13) return false;
	return true;
}

/**
 * 报道   六对半
 */
var checkLDB = function (cards) {
	var cg = _.groupBy(_.map(cards, function (n) { return n % 100 }));
	var cgs = Object.keys(cg);
	var ng = _.map(cgs, function (n) { return cg[n].length });
	ng = _.sortBy(ng);
	if (ng[0] != 1) return false;
	for (var i = 0; i < ng.length; i++) {
		if (i == 0 && ng[0] == 1) {
			continue;
		}
		else { if (ng[i] % 2 > 0) return false; }
	}
	return true;
}

/**
 * 报道  三顺子
 */
var checkSSZ = function (cards) {
	var vs = _.map(cards, function (n) { return (n % 100 == 1) ? 14 : n % 100 });
	vs = _.sortBy(vs);
	var f = vs[0];
	var l = vs[12];
	var fc = checkLX(f, vs, 3);
	if (fc != -1) {
		fc.push(0);
		_.map(fc, function (n) { vs[n] = 0; return true });
		_.remove(vs, function (n) { return n == 0 });
		var lc = checkLX(l, vs, 5, -1);
		if (lc != -1) {
			lc.push(vs.length - 1);
			_.map(lc, function (n) { vs[n] = 0; return true });
			_.remove(vs, function (n) { return n == 0 });
			var tc = checkLX(vs[0], vs, 5);
			if (tc != -1) return true;
		}
	}
	return false;
}

/**
 * check 连续牌
 * @param {Number} card cardNumber
 * @param {ArrayLike<Number>} cards cardArray
 * @param {Number} count how many times
 * @param {Number} order how to check
 * @return {Array} indexs in cards 
 */
var checkLX = function (card, cards, count, order) {
	order = order || 1;
	count = count || 5;
	var i_a = [];
	if (order != 1) {
		for (var i = 1; i <= count - 1; i++) {
			var fi = _.findIndex(cards, function (n) { return n == (card - i) });
			if (fi == -1) return -1;
			i_a.push(fi);
		}
	} else {
		for (var i = 1; i <= count - 1; i++) {
			var fi = _.findIndex(cards, function (n) { return n == (card + i) });
			if (fi == -1) return -1;
			i_a.push(fi);
		}
	}
	return i_a;
}

/**
 * 报道  三同花
 */
var checkSTH = function (cards) {
	var hs = _.map(cards, function (n) { return parseInt(n / 100) });
	hs = _.groupBy(hs);
	var ng = _.map(Object.keys(hs), function (n) { return hs[n].length });
	ng = _.sortBy(ng);
	if (ng[0] == 3 && ng[1] == 5 && ng[2] == 5) return true;
	return false;
}

var specialCards = {
	QL: checkQL,
	YTL: checkYTL,
	SSZ: checkSSZ,
	LDB: checkLDB,
	STH: checkSTH
}

/**
 * 分析同花顺 一次
 * @param {ArrayLike<Number>} cards card array(sorted)
 * @return {Array} index array
 */
var analyses_ths = function (cards) {
	var rs = [];
	var hs = _.groupBy(cards, function (n) { return parseInt(n / 100) });
	for (var i in hs) {
		var hl = hs[i].length;
		if (hl >= 5) {
			var j = hl - 1;
			while (j >= 5) {
				var c_o_s = checkLX(hs[i][j], cards, 5, 2);
				if (c_o_s != -1) return getPos([hs[i][j]], cards).concat(c_o_s);
				j--;
			}
		}
	}
	return rs.length == 0 ? -1 : rs;
}

/**
 * 分析铁支 一次
 * @param {ArrayLike<Number>} cards card array(sorted)
 * @return {Array} index array
 */
var analyses_tz = function (cards) {
	var rs = [];
	var ns = _.groupBy(cards, function (n) { return n % 100 });
	for (var i in ns) {
		if (ns[i].length == 4) {
			return getPos(ns[i], cards);
		}
	}
	return rs.length == 0 ? -1 : rs;
}

/**
 * 分析葫芦 一次
 * @param {ArrayLike<Number>} cards cards array
 * @return {Array} index array
 */
var analyses_hl = function (cards) {
	var ts = sanshuangzhang(cards);
	var ss = sanshuangzhang(cards, 2);
	if (ts.length > 0 && ss.length > 0) return ts[0].concat(ss[0]);
	return -1;
}

/**
 * 分析同花 一次
 * @param {ArrayLike<Number>} cards cards array
 * @return {Array} index array
 */
var analyses_th = function (cards) {
	var rs = [];
	var hs = _.groupBy(cards, function (n) { return parseInt(n / 100) });
	for (var i in hs) {
		if (hs[i].length >= 5) {
			return getPos(hs[i].splice(-5), cards);
		}
	}
	return rs.length == 0 ? -1 : rs;
}

/**
 * 分析顺子  一次
 * @param {ArrayLike<Number>} cards cards array
 */
var analyses_sz = function (cards) {
	var vs = _.groupBy(cards, function (n) { return n % 100 == 1 ? 14 : (n % 100) });
	var ng = Object.keys(vs);
	var os = _.map(ng, function (n) { return Number(n) });
	var ol = os.length;
	if (ol < 5) return -1;
	while (ol >= 5) {
		var lr = checkLX(os[ol - 1], os, 5, 2);
		if (lr != -1) {
			var fi = [];
			for (var j = 1; j <= 5; j++) {
				fi.push(vs[ng[ol - j]][0]);
			}
			if (checkQYS(fi)) return -1;
			var pss = getPos(fi, cards);
			return pss;
		}
		ol--;
	}
	return -1;
}

/**
 * 分析三张或者两张
 * @param {ArrayLike<Number>} cards cards array
 * @param {Number} l two or three  default 3 
 * @return {Array} all index array per
 */
var sanshuangzhang = function (cards, l) {
	l = l || 3;
	var rs = [];
	var vs = _.groupBy(cards, function (n) { return n % 100 });
	var ns = Object.keys(vs);
	for (var i = ns.length - 1; i >= 0; i--) {
		if (vs[ns[i]].length == l) {
			rs.push(getPos(vs[ns[i]], cards));
		}
	}
	return rs.length == 0 ? -1 : rs;
}

/**
 * 根据位置返回牌值
 * @param {Array} pos pos array 
 * @param {Array} cards 
 */
var getValue = function (pos, cards) {
	var rs = [];
	for (var i in pos) {
		rs.push(cards[pos[i]]);
	}
	return rs;
}

/**
 * 在所有牌中查找出需要查找的牌的位置返回
 * @param {ArrayLike<Number>} findCards find card array
 * @param {ArrayLike<Number>} cards cards array
 * @return {Array} finded array
 */
var getPos = function (findCards, cards) {
	var pos = [];
	for (var i = 0; i < findCards.length; i++) {
		var f_i = _.findIndex(cards, function (n) { return n == findCards[i] });
		pos.push(f_i);
	}
	return _.sortBy(pos);
}

/**
 * 根据值在数组中删除一次
 * @param {*} cv 
 * @param {*} cards 
 */
var removeCardsByValue = function(cv,cards){
	var f_i = _.findIndex(cards,function(n){return n==cv});
	cards.splice(f_i,1);
	return cards;
}

/**
 * 分析两对  一次
 * @param {ArrayLike<Number>} cards cards array
 */
var analyses_ld = function (cards) {
	var sc = sanshuangzhang(cards, 2);
	if (sc != -1 && sc.length >= 2) {
		return sc.pop().concat(sc.pop());
	};
	return -1;
}

var analyses_st = function (cards) {
	var sc = sanshuangzhang(cards);
	if (sc != -1) {
		return sc.pop();
	}
	return -1;
}

/**
 * 分析剩余三张牌的牌型  3 冲三 2 对子 1 乌龙
 * @param {Array} cards 
 * @return {Number} type
 */
var analyses_fd = function (cards) {
	var sc = sanshuangzhang(cards);
	if (sc != -1) return c_t.CS;
	var tc = sanshuangzhang(cards, 2);
	if (sc != -1) return
	return c_t.WL;
}

/**
 * 分析对子  一次
 * @param {ArrayLike<Number>} cards cards array
 */
var analyses_dz = function (cards) {
	var sc = sanshuangzhang(cards, 2);
	if (sc != -1) return sc.pop();
	return -1;
}

/**
 * 分析牌型
 * @param {Array} cards 
 * @return {Array} all cards type array
 */
var analysesCards = function (cards) {
	cards = _.sortBy(cards, function (n) { return n % 100 });
	var rs = [];
	for (var i = 9; i >= 2; i--) {
		var cs = _.clone(cards);
		var rsa = getCardsType(cs, i);
		if (rsa.type == i) {
			var ac = cicleAnalyses(cs, i);
			rs.unshift(ac);
		}
	}
	return rs;
}

/**
 * 
 * @param {*} cards 
 * @param {*} rt 
 * @param {*} result 
 * @param {*} rs 
 */
var cicleAnalyses = function (cards, rt, result, rs) {
	rt = rt || 9;
	result = result || [];
	var cs = _.clone(cards);
	if (cs.length == 4 || result.length >= 2) {
		var rc = fullCards(result, cs);
		result = rc.result;
		cs = rc.cs;
	}
	if (cs.length == 3) {
		var rs3 = getCardsType(cs, 1);
		result.unshift(rs3);
		return result;
	}
	if (!rs) rs = getCardsType(cs, rt);
	if (rs.type > 1) {
		cs = removeDealCards(rs.indexes, cs);
		delete rs.indexes;
		result = sortCards(rs.type, rs.cards, result);
		return cicleAnalyses(cs, rs.type, result);
	}
	if (rs.type == 1) {
		if (cs.length >= 5) {
			var rc = fullCards(result, cs);
			result = rc.result;
			cs = rc.cs;
			return cicleAnalyses(cs, rs.type, result);
		}
		return result;
	}
	if (cs.length <= 0) {
		return result;
	}
}

var removeDealCards = function (indexs, cards) {
	_.remove(cards, function (n, i) { return indexs.indexOf(i) != -1 });
	return cards;
}

/**
 * 补充缺牌的组
 * @param {Array} resu result of Analyses
 * @param {*} cards 
 */
var fullCards = function (resu, cards) {
	if (resu.length < 2) {
		if (resu.length == 1) resu.unshift({ cards: [], type: 1 });
		if (resu.length == 0) resu = [{ cards: [], type: 1 }, { cards: [], type: 1 }];
	}
	for (var i in resu) {
		var rcl = resu[i].cards.length;
		var rm_cards = _.clone(cards);
		rm_cards = _.uniqBy(rm_cards,function(n){return n%100});
		while (rcl < 5) {
			cards = removeCardsByValue(rm_cards[0],cards);
			resu[i].cards.push(rm_cards[0]);
			rm_cards.shift();
			rcl++;
		}
	}
	return { result: resu, cs: cards };
}

/**
 * 分析单个牌型  出现则返回
 * @param {Array} cards 
 * @param {Number} rule_type 
 * @return {Object} {indexes:[index array],type:Number}
 */
var getCardsType = function (cards, rule_type) {
	var cs = _.clone(_.sortBy(cards, function (n) { return n % 100 }));
	var mo = Object.keys(analyses_method);
	if (rule_type == 1) {
		var r = analyses_method[rule_type](cards);
		return { cards: cs, indexes: getPos(cs, cs), type: r };
	}
	for (var i = mo.length - 1; i >= 0; i--) {
		if (i <= rule_type && i > 1) {
			var method = analyses_method[i];
			var r = method(cs);
			if (r != -1) {
				return { cards: getValue(r, cs), indexes: r, type: i }
			}
		}
	}
	return { cards: cs, indexes: getPos(cs, cs), type: 1 };
}

/**
 * 对牌型数组检测和排序
 * @param {Number} add_type add cards type
 * @param {Array} add_cards add cards
 * @param {Array} target_cards_arr all cards
 */
var sortCards = function (add_type, add_cards, target_cards_arr) {
	target_cards_arr = target_cards_arr || [];
	if (target_cards_arr.length == 0) {
		target_cards_arr.push({ cards: add_cards, type: add_type });
		return target_cards_arr;
	}
	if (target_cards_arr[0].type < add_type) return -1;
	if (target_cards_arr[0].type == add_type) {
		var rc = compare(target_cards_arr[0].cards, add_cards, add_type);
		if (rc) target_cards_arr.splice(1, 0, { cards: add_cards, type: add_type });
		else target_cards_arr.unshift({ cards: add_cards, type: add_type });
	}
	if (target_cards_arr[0].type > add_type) target_cards_arr.unshift({ cards: add_cards, type: add_type });
	return target_cards_arr;
}

/**
 * 相同牌型比较
 * @param {Array} c old cards
 * @param {Array} tc new cards
 * @param {Number} type cards type 
 * @return {Boolen} return c < tc
 */
var sameTypeCompare = function (c, tc, type) {
	c = _.sortBy(c, function (n) { return n % 100 });
	tc = _.sortBy(tc, function (n) { return n % 100 });
	var vc = c[2] % 100;
	var vt = tc[2] % 100;
	type = Number(type);
	switch (type) {
		case 9:
		case 8:
		case 5:
		case 4:
		case 7: {
			if (vc == vt) return -1;
			return vc < vt;
		}
		case 6: {
			var wr = -1;
			for (var i = c.length - 1; i >= 0; i--) {
				if ((tc[i] % 100) > (c[i] % 100)) {
					wr = 1;
					break;
				}
				else if ((tc[i] % 100) < (c[i] % 100)) {
					wr = 0;
					break;
				}
			}
			return wr;
		}
		case 3: {
			if ((c[3] % 100) == (tc[3] % 100)) {
				if ((c[1] % 100) == (tc[1] % 100)) {
					var gc = _.groupBy(c, function (n) { return n % 100 });
					var gt = _.groupBy(tc, function (n) { return n % 100 });
					var sc = 0, st = 0;
					for (var ic in gc) {
						if (gc[ic].length == 1) {
							sc = Number(ic);
							break;
						}
					}
					for (var it in gt) {
						if (gt[it].length == 1) {
							st = Number(it);
							break;
						}
					}
					if (sc == st) return -1;
					return sc < st;
				}
				return (c[1] % 100) < (tc[1] % 100);
			}
			return (c[3] % 100) < (tc[3] % 100);
		}
		case 2: {
			var gc = _.groupBy(c, function (n) { return n % 100 });
			var gt = _.groupBy(tc, function (n) { return n % 100 });
			var cc = 0, ct = 0;
			for (var ic in gc) {
				if (gc[ic].length >= 2) {
					cc = Number(ic);
					delete gc[ic];
					break;
				}
			}
			for (var it in gt) {
				if (gt[it].length >= 2) {
					ct = Number(it);
					delete gt[it];
					break;
				}
			}
			if (cc == ct) {
				var tk = _.map(Object.keys(gt), function (n) { return Number(n) });
				var ck = _.map(Object.keys(gc), function (n) { return Number(n) });
				for (var i = ck.length - 1; i >= 0; i--) {
					if (ck[i] == tk[i]) continue;
					return ck[i] < tk[i];
				}
				return -1;
			}
			return cc < ct;
		}
	}
};

var compare = function (c, tc) {
	c = _.sortBy(c, function (n) { return n % 100 });
	tc = _.sortBy(tc, function (n) { return n % 100 });
	if (c.length == 3) {
		var t1 = getCardsType(c, 1);
		var t2 = getCardsType(tc, 1);
		if (t1.type != t2.type) {
			return t1.type < t2.type;
		} else {
			var fv = c[0] % 100;
			var sv = c[1] % 100;
			var tv = c[2] % 100;
			var ftv = tc[0] % 100;
			var stv = tc[1] % 100;
			var ttv = tc[2] % 100;
			switch (t1.type) {
				case 1: {
					if (tv != ttv) return tv < ttv;
					else {
						if (sv != stv) return sv < stv;
						else {
							if (fv != ftv) return fv < ftv;
							else {
								return false;
							}
						}
					}
				}
				case -2:
				case -1:
				case 0: {
					return sv < stv;
				}
			}
		}
	} else {
		var t1 = getCardsType(c, 9);
		var t2 = getCardsType(tc, 9);
		if (t1.type != t2.type) {
			return t1.type < t2.type;
		}
	}
	return sameTypeCompare(c, tc, t1.type);
}

/**
 * 分析牌型类型
 */
var c_t = {
	THS: 9,
	TZ: 8, HL: 7, TH: 6, SZ: 5, ST: 4, LD: 3, DZ: 2, WL: 1, CS: -1, SD: -2
};

/**
 * 分析牌型方法
 */
var analyses_method = {
	9: analyses_ths, 8: analyses_tz, 7: analyses_hl,
	6: analyses_th, 5: analyses_sz, 4: analyses_st,
	3: analyses_ld, 2: analyses_dz, 1: analyses_fd
}

/**
 * ALL CHECK
 */
var allCheck = function (cards) {
	cards = _.sortBy(cards, function (n) { return n % 100 });
	var t = [];
	for (var f in specialCards) {
		if (specialCards[f](cards)) t.push(all_type[f]);
	}
	if (t.length > 0) return _.max(t);
	return analysesCards(cards);
}

var getPoke = function (players) {
	var count = players.length;
	if (count > 4) return -1;
	var pokes = [];
	for (var i = 1; i <= 4; i++) {
		for (var j = 2; j <= 14; j++) {
			pokes.push(i * 100 + j);
		}
	}
	pokes = _.shuffle(pokes);
	
	var hcs = [];
	for (var c = 1; c <= count; c++) {
		if (players[c - 1]) {
			var p = pokes.splice(0, 13);
			var ap = allCheck(_.sortBy(p, function (n) { return n % 100 }));
			hcs.push(ap);
		} else {
			hcs.push([]);
		}

	}
	return hcs;
}

module.exports = {
	compare: compare,
	getPoke: getPoke,
	c_t: c_t,
	all_type: all_type
};

//console.log(JSON.stringify(allCheck(_.sortBy([112,414,114,402,302,202,208,308,404,104,410,310,210]))))
// var poss = getPoke([1, 1, 0, 1]);
// console.log(JSON.stringify(poss));
//{"cards":[[{"cards":[104,211,114],"indexes":[0,1,2],"type":1},{"cards":[204,104,310,207,302],"type":2},{"cards":[114,214,205,108,312],"type":2}]
// var a = [204,104,310,207,302,104,211,114,114,214,205,108,312]
//test
/**
var pl = function (cards) {
	var l = []; var m = 0;
	// 牌型大小排序
	var pl1 = function (b) {
		var bj = _.clone(b[0]);
		var seat = cards.length;
		for (var i = 1; i < b.length; i++) {
			var p = _.clone(bj);
			var cp = _.clone(b[i]);
			var c = !!compare(p, cp);
			if (!c) seat -= 1;
		}
		l.push(seat);
		m++;
		if (m >= cards.length) return false;
		b.shift();
		b.push(bj);
		return pl1(b);
	}
	pl1(cards);
	return l;
}
var poss = getPoke([1, 1, 0, 1]);
_.remove(poss, function (n) { return n.length == 0 });
var cps = _.map(_.compact(poss), function (n) { return n[0] });
console.log(JSON.stringify(cps));
var t = [];
for (var j = 0; j < 3; j++) {
	var ctc = [];
	for (var n = 0; n < cps.length; n++) {
		ctc.push(cps[n][j].cards);
	}
	t.push(ctc);
}
console.log('t', t, 't');
var rs = [];
for (var i in t) {
	console.log('t[i]', t[i], 't[i]');
	rs.push(pl(t[i]));
}
console.log('rs', rs);
 */