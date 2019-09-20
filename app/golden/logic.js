/**
 * Created by Administrator on 2016/9/19.
 */
'use strict';
var _ = require('lodash');
var pokeType = {
    BAO_ZI: 32,
    SHUN_JIN: 16,
    JIN_HUA: 8,
    SHUN_ZI: 4,
    DUI_ZI: 2,
    DAN_ZH: 1
};
//需要牌数据结构 pokeObj    id:玩家ID  poke:[{num:牌数,color:花色}]  1:黑桃 2：红桃 3：梅花  4：方片
//需要牌数据结构 pokeObj    id:玩家ID  poke:[101,201,301]  1:黑桃 2：红桃 3：梅花  4：方片
//牌结构为poke:[101,201,301]  （三张A  花色为（黑红梅））
var compare = function (p1, p2) {
    p1 = _.sortBy(p1, function (n) {
        return n % 100;
    });
    p2 = _.sortBy(p2, function (n) {
        return n % 100;
    });

    //非法牌型检测   暂不打开
    //if(checkIllegal(p1,p2)) return -1;
    let t1 = getPokerType(p1);
    let t2 = getPokerType(p2);
    if (t1 === -1 || t2 === -1) return -1;
    if (t1 !== t2) {
        return t1 > t2;
    }
    return comparePoke(p1, p2, t1);
};
var checkIllegal = function (p1, p2) {
    if (p1 < 0 || p2 < 0) return true;
    let v1 = _.map(p1, function (n) {
        return n % 100
    });
    let v2 = _.map(p2, function (n) {
        return n % 100
    });
    if (v1[0] < 1 || v1[2] > 13 || v2[0] < 1 || v2[2] > 13) return true;
    for (var v of Object.keys(p1)) {
        if (_.findIndex(p2, function (n) {
            return n === p1[v]
        }) !== -1) return true;
    }
    return false;
};
var comparePoke = function (p1, p2, t) {
    p1 = _.map(p1, function (n) {
        return n % 100
    });
    p2 = _.map(p2, function (n) {
        return n % 100
    });
    if (!POKE_BIG[t]) return -1;
    return POKE_BIG[t](p1, p2);
};
var compareBaoZi = function (v1, v2) {
    v1 = v1[0] === 1 ? [14, 14, 14] : v1;
    v2 = v2[0] === 1 ? [14, 14, 14] : v2;
    return v1[0] > v2[0];
};
var compareShunZi = function (v1, v2) {
    return (v1[1] > v2[1]);
};
var compareDuiZi = function (v1, v2) {
    if (v1[0] === 1) {
        v1.shift();
        v1.push(14)
    }
    if (v1[0] === 1) {
        v1.shift();
        v1.push(14)
    }
    if (v2[0] === 1) {
        v2.shift();
        v2.push(14)
    }
    if (v2[0] === 1) {
        v2.shift();
        v2.push(14)
    }
    let d1 = _.difference(v1, [v1[1]]);
    let d2 = _.difference(v2, [v2[1]]);
    return !!(v1[1] > v2[1] || (v1[1] === v2[1] && d1[0] > d2[0]));
};
var compareDanZh = function (v1, v2) {
    if (v1[0] === 1) {
        v1.shift();
        v1.push(14)
    }
    if (v2[0] === 1) {
        v2.shift();
        v2.push(14)
    }
    for (var i = 2; i > -1; i--) {
        if (v1[i] > v2[i]) return true;
    }
    return false;
};
var POKE_BIG = {
    32: compareBaoZi,
    16: compareShunZi,
    4: compareShunZi,
    8: compareDanZh,
    2: compareDuiZi,
    1: compareDanZh
};
//获取牌面类型
var getPokerType = function (p) {
    let typeS = 0;
    _.forEach(dealIs, function (v, k) {
        typeS += v(p);
    });
    if (typeS === 12) return pokeType.SHUN_JIN;
    if (typeS === 0) return pokeType.DAN_ZH;
    if (_.findKey(pokeType, function (n) {
        return n === typeS
    })) return typeS;
    return -1;
};

var dealIs = {};

dealIs.isShunZi = function (p) {
    let f = p[0] % 100;
    let s = p[1] % 100;
    let t = p[2] % 100;
    // if (f == 1) f = 14;
    if ((t - 1) === s && ((s - 1) === f || (s - 11) === f)) return pokeType.SHUN_ZI;
    return 0;
};

dealIs.isJinHua = function (p) {
    let f = parseInt(p[0] / 100);
    let s = parseInt(p[1] / 100);
    let t = parseInt(p[2] / 100);
    if (f === s && s === t) return pokeType.JIN_HUA;
    return 0;
};

dealIs.isBaoZi = function (p) {
    let f = p[0] % 100;
    let s = p[1] % 100;
    let t = p[2] % 100;
    if (f === s && s === t) return pokeType.BAO_ZI;
    return 0;
};

dealIs.isDuiZi = function (p) {
    let f = p[0] % 100;
    let s = p[1] % 100;
    let t = p[2] % 100;
    if ((f === s || s === t) && _.difference([f, s, t], [s]).length > 0) return pokeType.DUI_ZI;
    return 0;
};

var getAllPoke = function () {
    let allPokes = [];
    for (var i = 1; i < 5; i++) {
        for (var j = 1; j < 14; j++) {
            allPokes.push(i * 100 + j);
        }
    }
    return allPokes;
};
var getShunJin = function (ap, sj, ti) {
    let alP = [];
    for (var i = 0; i < 52; i++) {
        alP.push(i);
    }
    alP = _.difference(alP, ti);
    let alV = {}; let alc = {};
    for (var j in alP) {
        let v = ap[alP[j]] % 100;
        let c = parseInt(ap[alP[j]] / 100);
        alc[c] = alc[c] || [];
        alc[c].push(ap[alP[j]]);
        alV[v] = alV[v] || [];
        alV[v].push(ap[alP[j]]);
    }
    let alVA = Object.keys(alV);
    if (alVA.length < 3) return -1;
    let fOw = true;
    for (var i in alVA) {
        i = Number(i);
        let f = Number(alVA[i]);
        let sc = Number(alVA[i + 1] || 0);
        let tc = Number(alVA[i + 2] || 0);
        if (sc == (f + 1) && tc == (f + 2)) {
            fOw = false;
            break;
        }
        if (f === 12 && sc === 13 && alVA[0] === 1) {
            fOw = false;
            break;
        }
    }
    for (var n in alc) {
        if (alc[n].length > 3) {
            if (fOw) fOw = false;
            continue;
        }
    }
    if (fOw) return -1;
    var randSJ = [];
    var getRandSz = function () {
        let randArr = [];
        for (var i in alVA) {
            i = Number(i);
            let f = Number(alVA[i]);
            let sc = Number(alVA[i + 1] || 0);
            let tc = Number(alVA[i + 2] || 0);
            if (sc === (f + 1) && tc === (f + 2)) randArr.push(f);
            if (f === 12 && sc === 13 && alVA[0] == 1) randArr.push(f);
        }
        return makeArrWithColor(randArr);
    };
    var makeArrWithColor = function (ra) {
        var rv = ra[0];
        let tic = ((rv + 2) > 13 ? 1 : (rv + 2));
        let fi = _.map(alV[ra[0]], function (n) { return parseInt(n / 100) });
        let si = _.map(alV[ra[0] + 1], function (n) { return parseInt(n / 100) });
        let ti = _.map(alV[tic], function (n) { return parseInt(n / 100) });
        var hasRS = false; var color = 0;
        for (var i in fi) {
            var sj = _.findIndex(si, function (n) { return n == fi[i] });
            var tj = _.findIndex(ti, function (n) { return n == fi[i] });
            if (sj != -1 && tj != -1) {
                color = fi[i];
                hasRS = true;
            }
        }
        if (hasRS) {
            randSJ.push([rv + color * 100, rv + 1 + color * 100, tic + color * 100]);
        }
        ra.shift();
        if (ra.length <= 0) return -1;
        return makeArrWithColor(ra);
    };
    getRandSz();
    if (randSJ.length <= 0) return -1;
    return randSJ[parseInt(Math.random() * randSJ.length)];
};
var getBaoZi = function (ap, bz, ti) {
    let alP = [];
    for (var i = 0; i < 52; i++) {
        alP.push(i);
    }
    alP = _.difference(alP, ti);
    let alV = {};
    for (var j in alP) {
        let v = ap[alP[j]] % 100;
        alV[v] = alV[v] || [];
        alV[v].push(ap[alP[j]]);
    }
    for (var i in alV) {
        if (alV[i].length < 3) delete alV[i];
    }
    let alVA = Object.keys(alV);
    if (alVA.length <= 0) return -1;
    let bz_arr = alV[alVA[parseInt(Math.random() * alVA.length)]];
    if (bz_arr.length > 3) {
        bz_arr.splice(parseInt(Math.random() * bz_arr.length), 1);
    }
    return bz_arr;
};
var getShunZi = function (ap, sz, ti) {
    let alP = [];
    for (var i = 0; i < 52; i++) {
        alP.push(i);
    }
    alP = _.difference(alP, ti);
    let alV = {};
    for (var j in alP) {
        let v = ap[alP[j]] % 100;
        alV[v] = alV[v] || [];
        alV[v].push(ap[alP[j]]);
    }
    let alVA = Object.keys(alV);
    if (alVA.length < 3) return -1;
    let fOw = true;
    for (var i in alVA) {
        i = Number(i);
        let f = Number(alVA[i]);
        let sc = Number(alVA[i + 1] || 0);
        let tc = Number(alVA[i + 2] || 0);
        if (sc == (f + 1) && tc == (f + 2)) {
            fOw = false;
            break;
        }
        if (f === 12 && sc === 13 && alVA[0] === 1) {
            fOw = false;
            break;
        }
    }
    if (fOw) return -1;
    var getRandSz = function () {
        let randArr = [];
        for (var i in alVA) {
            i = Number(i);
            let f = Number(alVA[i]);
            let sc = Number(alVA[i + 1] || 0);
            let tc = Number(alVA[i + 2] || 0);
            if (sc === (f + 1) && tc === (f + 2)) randArr.push(f);
            if (f === 12 && sc === 13 && alVA[0] == 1) randArr.push(f);
        }
        let ri = parseInt(Math.random() * randArr.length);
        return makeArrWithColor(randArr[ri]);
    };
    var makeArrWithColor = function (rv) {
        let tic = ((rv + 2) > 13 ? 1 : (rv + 2));
        let fi = parseInt(Math.random() * alV[rv].length);
        let si = parseInt(Math.random() * alV[rv + 1].length);
        let ti = parseInt(Math.random() * alV[tic].length);
        return [alV[rv][fi], alV[rv + 1][si], alV[tic][ti]];
    };
    let rsArrValue = getRandSz();
    return rsArrValue;
};
var getJinHua = function (ap, jh, ti) {
    let alP = [];
    for (var i = 0; i < 52; i++) {
        alP.push(i);
    }
    alP = _.difference(alP, ti);
    let alV = {};
    for (var j in alP) {
        let v = parseInt(ap[alP[j]] / 100);
        alV[v] = alV[v] || [];
        alV[v].push(ap[alP[j]]);
    }
    for (var i in alV) {
        if (alV[i].length < 3) delete alV[i];
    }
    let alVA = Object.keys(alV);
    let hsIndex = alVA[parseInt(Math.random() * alVA.length)];
    let jhP = alV[hsIndex];
    let threeIndex = [];
    let m = 0;
    var randThree = function () {
        let ind = parseInt(Math.random() * jhP.length);
        if (threeIndex.length > 18) return -1;
        if (_.findIndex(threeIndex, function (n) {
            return n === ind
        }) === -1) {
            threeIndex.push(ind);
            m++;
        }
        if (m >= 3) return threeIndex;
        return randThree();
    };
    let rt = randThree();
    if (rt === -1) return -1;
    let rsArrValue = [jhP[rt[0]], jhP[rt[1]], jhP[rt[2]]];
    return rsArrValue;
};
var getDuiZi = function (ap, jh, ti) {
    let alP = [];
    for (var i = 0; i < 52; i++) {
        alP.push(i);
    }
    alP = _.difference(alP, ti);
    let alV = {};
    for (var j in alP) {
        let v = ap[alP[j]] % 100;
        alV[v] = alV[v] || [];
        alV[v].push(ap[alP[j]]);
    }
    for (var i in alV) {
        if (alV[i].length < 2) delete alV[i];
    }
    let alVA = Object.keys(alV);
    let aFate = parseInt(Math.random() * alVA.length);
    let av = alV[alVA[aFate]];
    let nav = [];
    let avFate = parseInt(Math.random() * av.length);
    nav.push(av[avFate]);
    av.splice(avFate, 1);
    let av2Fate = parseInt(Math.random() * av.length);
    nav.push(av[av2Fate]);
    alVA.splice(aFate, 1);
    let lFate = parseInt(Math.random() * alVA.length);
    let tArr = alV[alVA[lFate]];
    nav.push(tArr[parseInt(Math.random() * tArr.length)]);
    return nav;
};
var getPokeWithType = {
    32: getBaoZi,
    16: getShunJin,
    4: getShunZi,
    2: getDuiZi,
    8: getJinHua
};

var getPoke = function (gpa) {
    let allPokes = getAllPoke();
    if (!_.isArray(gpa)) return -1;
    let returnArr = [];
    let l = 0;
    let comArr = {};
    let threeIndex = [];
    let m = 0;
    var randThree = function () {
        let ind = parseInt(Math.random() * 51);
        if (threeIndex.length > 18) return -1;
        if (_.findIndex(threeIndex, function (n) {
            return n === ind
        }) === -1) {
            threeIndex.push(ind);
            m++;
        }
        if (m >= 3) return threeIndex;
        return randThree();
    };
    for (var n = 0; n < gpa.length; n++) {
        if (gpa[n].length <= 0) {
            returnArr.push([]);
            continue;
        }
        //rate格式为整数   例如rate:[{name:'BAO_ZI'，value:50}]
        if (gpa[n].rate) {
            let randRate = parseInt(Math.random() * 99) + 1;
            let rateNum = 0;
            let poke_type;
            for (var i in gpa[n].rate) {
                let rateN = rateNum + gpa[n].rate[i].value;
                if (rateN > 100) break;
                if (randRate > rateNum && randRate <= rateN) {
                    poke_type = gpa[n].rate[i].name;
                    break;
                }
                rateNum += gpa[n].rate[i].value;
            }
            if (poke_type) {
                var gpt = getPokeWithType[pokeType[poke_type]];
                if (!gpt) {
                    returnArr.push(-1);
                    continue;
                }
                let gpw = gpt(allPokes, comArr[poke_type] || [], threeIndex);
                if (gpw === -1) {
                    returnArr.push(-1);
                    continue;
                }
                let gpaIndex = _.map(gpw, function (n) {
                    return _.findIndex(allPokes, function (m) {
                        return m === n
                    })
                });
                comArr[poke_type] = comArr[poke_type] || [];
                comArr[poke_type].push(gpw);
                returnArr.push(gpw);
                threeIndex = threeIndex.concat(gpaIndex);
                m = 0;
                l++;
                continue;
            }
            returnArr.push(-1);
        } else returnArr.push(-1);
    }
    for (var i in returnArr) {
        if (returnArr[i] === -1) {
            let ti = randThree();
            m = 0;
            if (ti === -1) return -1;
            returnArr.splice(Number(i), 1, [allPokes[ti[3 * l]], allPokes[ti[1 + 3 * l]], allPokes[ti[2 + 3 * l]]]);
            l++;
        }
    }
    return returnArr;
};

module.exports = {
    compare: compare,
    getPokerType: getPokerType,
    pokeType: pokeType,
    getPoke: getPoke
};