var _ = require('lodash');
var rand = function (count) {
    return parseInt(Math.random() * count);
};
var randSeventeen = function (count, pokes, pa) {
    pa = pa || [];
    var ind = rand(count);
    pa.push(pokes[ind]);
    pokes.splice(ind, 1);
    if (pa.length >= 17) return { pa: pa, pokes: pokes };
    return randSeventeen(count - 1, pokes, pa);
};
//发牌
var licensing = function () {
    var nowPokes = [];
    for (var i = 1; i < 5; i++) {
        for (var j = 1; j < 14; j++) {
            nowPokes.push(i * 100 + j);
        }
    }
    nowPokes.push(15, 16);
    var pokes = [];
    for (var i = 0; i < 3; i++) {
        var count = nowPokes.length;
        var p_obj = randSeventeen(count, nowPokes);
        pokes.push(p_obj.pa);
        nowPokes = p_obj.pokes;
    }
    return { pokes: pokes, nowPokes: nowPokes };
};

var PT = {
    DAN_ZHANG: 1,
    DUI_ZI: 2,
    SAN_ZHANG: 3,
    SAN_DAI_YI: 4,
    SAN_DAI_DUI: 5,
    SHUN_ZI: 6,
    SAN_SHUN: 7,
    SHUANG_SHUN: 8,
    SI_DAI_ER: 9,
    FEI_JI: 11,
    GUI_BOM: 16,
    BOM: 10
};
var big_small = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 2, 15, 16];
var comparePoke = function (prePokes, needPokes) {
    var ppc = checkPoke(prePokes);
    if (ppc === PT.GUI_BOM) return false;
    var npc = checkPoke(needPokes);
    if (npc == -1 || ppc == -1) return -1;
    if (npc !== ppc && (npc == PT.BOM || npc == PT.GUI_BOM)) return true;
    if (npc === ppc) {
        var vps = _.sortBy(_.map(prePokes, function (n) {
            if (n % 100 == 1) return parseInt(n / 100) * 100 + 14;
            return n;
        }), function (n) {
            return n % 100
        });
        var vs = _.map(vps, function (n) {
            return n % 100;
        });
        var nps = _.sortBy(_.map(needPokes, function (n) {
            if (n % 100 == 1) return parseInt(n / 100) * 100 + 14;
            return n;
        }), function (n) {
            return n % 100
        });
        var ns = _.map(nps, function (n) {
            return n % 100;
        });
        var pt = _.invert(PT);
        return compare[pt[ppc]](vs, ns);
    }
    return false;
};
var compare = {};
compare['SHUN_ZI'] = function (vs, ns) {
    var pl = vs.length;
    var nl = ns.length;
    if (pl !== nl) return false;
    return ns[0] > vs[0];
};
compare['DAN_ZHANG'] = function (vs, ns) {
    var vs_index = big_small.indexOf(vs[0]);
    var ns_index = big_small.indexOf(ns[0]);
    if (-1 == vs_index || -1 == ns_index) return false;
    return vs_index < ns_index;
};
compare['SAN_DAI_YI'] = function (vs, ns) {
    var vs_index = big_small.indexOf(vs[2]);
    var ns_index = big_small.indexOf(ns[2]);
    if (-1 == vs_index || -1 == ns_index) return false;
    return vs_index < ns_index;
};
var changeLY = function(vs){
    var b = {};
    for (var i in vs) {
        b[vs[i]] = b[vs[i]] || 0;
        b[vs[i]]++;
    }
    var s_a = [];
    for (var i in b) {
        if (b[i] == 3) s_a.push(Number(i));
    }
    s_a = _.sortBy(s_a);
    return s_a[0];
}
compare['FEI_JI'] = function (vs, ns) {
    var v0 = changeLY(vs);
    var n0 = changeLY(ns);
    return v0<n0;
};
compare['SAN_ZHANG'] = compare['DAN_ZHANG'];
compare['SAN_SHUN'] = compare['DAN_ZHANG'];
compare['DUI_ZI'] = compare['DAN_ZHANG'];
compare['BOM'] = compare['DAN_ZHANG'];
compare['SHUANG_SHUN'] = compare['DAN_ZHANG'];
compare['SAN_DAI_DUI'] = compare['SAN_DAI_YI'];
compare['SI_DAI_ER'] = compare['SAN_DAI_YI'];

var checkPoke = function (pokes) {
    var l = pokes.length;
    if(l<=0) return -1;
    var vps = _.sortBy(_.map(pokes, function (n) {
        if (n % 100 == 1) return parseInt(n / 100) * 100 + 14;
        return n;
    }), function (n) {
        return n % 100
    });
    var vs = _.map(vps, function (n) {
        return n % 100;
    });
    if (l >= 5 && _.uniq(vs).length === l) {
        if(vs[0]==2 || vs[0]==1) return -1;
        var boolArr = _.map(vs, function (n, i, a) {
            if (a.length === (i + 1)) return true;
            return (n + 1) === a[i + 1];
        });
        var boolCount = _.difference(boolArr, [true]).length;
        if (boolCount === 0) return PT.SHUN_ZI;
        return -1;
    }
    switch (l) {
        case 1:
            {
                return PT.DAN_ZHANG;
            }
        case 2:
            {
                if (vs[0] === 15 && vs[1] === 16) return PT.GUI_BOM;
                if (vs[1] === vs[0]) return PT.DUI_ZI;
                return -1;
            }
        case 3:
            {
                if (vs[2] === vs[1] && vs[0] === vs[1]) return PT.SAN_ZHANG;
                return -1;
            }
        case 4:
            {
                var dif = _.difference(vs, [vs[2]]);
                if (dif.length === 0) return PT.BOM;
                if ((dif.length === 1 || dif.length === 3) && vs[2] == vs[1]) return PT.SAN_DAI_YI;
                return -1;
            }
        case 5:
            {
                if ((vs[0] == vs[1] && vs[1] != vs[2] && vs[2] == vs[3] && vs[3] == vs[4]) || (vs[0] == vs[1] && vs[1] == vs[2] && vs[2] != vs[3] && vs[3] == vs[4])) return PT.SAN_DAI_DUI;
                return -1;
            }
        case 6:
            {
                if (vs[0]!=2 && vs[0] === vs[2] && vs[3] === vs[5] && (vs[2] + 1) == vs[3]) return PT.SAN_SHUN;
                if (vs[0]!=2 && vs[0] === vs[1] && vs[2] === vs[3] && vs[4] === vs[5] && (vs[1] + 1) == vs[2] && (vs[3] + 1) == vs[4]) return PT.SHUANG_SHUN;
                if (vs[0] === vs[3] || vs[2] === vs[5]) return PT.SI_DAI_ER;
                return -1;
            }
        case 7:
            {
                return -1;
            }
        default:
            {
                if(vs[0]==2) return -1;
                var b = {};
                for (var i in vs) {
                    b[vs[i]] = b[vs[i]] || 0;
                    b[vs[i]]++;
                }
                var c = _.difference(_.values(b), [3]);
                if (checkSS(b)) return PT.SHUANG_SHUN;
                if (checkSanShun(b)) return PT.SAN_SHUN;
                // if (checkSE(b)) {
                //     if (c[0] == 1) return PT.SAN_DAI_YI;
                //     if (c[0] == 2) return PT.SAN_DAI_DUI;
                // }
                if (checkFJ(b)) {
                    var s_a = [];
                    for (var i in b) {
                        if (b[i] == 3) s_a.push(Number(i));
                    }
                    s_a = _.sortBy(s_a);
                    var evalStr = '';
                    for (var j = 0; j < (s_a.length - 1); j++) {
                        evalStr += ('(s_a[' + j + '] + 1) == s_a[' + (j + 1) + ']');
                        if (j !== (s_a.length - 2)) evalStr += ' && ';
                    }
                    if (eval(evalStr)) return PT.FEI_JI;
                }
                return -1;
            }
    }
};
//check˫˳
var checkSS = function (b) {
    var d = _.clone(b);
    var c = _.difference(_.values(b), [2]);
    if (c.length !== 0) return false;
    _.mapKeys(d, function (value, key) {
        if (value === 3) return key; delete d[key];
    });
    var keys = _.map(_.keys(d), function (n) { return Number(n) });
    var evalStr = 'c.length === 0';
    for (var i = 0; i < (keys.length - 1); i++) {
        evalStr += (' && (keys[' + i + ']+1) == keys[' + (i + 1) + ']')
    }
    return eval(evalStr);
};
//check飞机
var checkFJ = function (b) {
    var bv = _.values(b);
    var c = _.difference(bv, [3]);
    var cl = 0;
    if ((bv.length - c.length) == c.length && _.difference(c, [c[0]]).length == 0) return true;
    for (var i in c) {
        cl += c[i];
    }
    if ((bv.length - c.length) == cl) return true;
    return false;
}
//check����
var checkSE = function (b) {
    var d = _.clone(b);
    var c = _.difference(_.values(b), [3]);
    if (c.length !== 2) return false;
    _.mapKeys(d, function (value, key) {
        if (value === 3) return key; delete d[key];
    });
    var keys = _.map(_.keys(d), function (n) { return Number(n) });
    var evalStr = 'c[0]===c[1] && c[0]<3';
    for (var i = 0; i < (keys.length - 1); i++) {
        evalStr += (' && (keys[' + i + ']+1) == keys[' + (i + 1) + ']')
    }
    console.log('checkSE', evalStr);
    return eval(evalStr);
};
//check三顺
var checkSanShun = function (b) {
    var d = _.clone(b);
    var c = _.difference(_.values(b), [3]);
    if (c.length !== 0) return false;
    _.mapKeys(d, function (value, key) {
        if (value === 3) return key; delete d[key];
    });
    var keys = _.map(_.keys(d), function (n) { return Number(n) });
    var evalStr = 'c.length === 0';
    for (var i = 0; i < (keys.length - 1); i++) {
        evalStr += (' && (keys[' + i + ']+1) == keys[' + (i + 1) + ']')
    }
    return eval(evalStr);
};
module.exports = {
    licensing: licensing,
    checkPoke: checkPoke,
    PT: PT,
    compare: comparePoke
};