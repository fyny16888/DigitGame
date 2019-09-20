'use strict';

var _ = require('lodash');

// 牌型
var TYPES = [
    { niu: 0, mul: 1 },         // 无牛
    { niu: 1, mul: 1 },         // 牛一
    { niu: 2, mul: 1 },         // 牛二
    { niu: 3, mul: 1 },         // 牛三
    { niu: 4, mul: 1 },         // 牛四
    { niu: 5, mul: 1 },         // 牛五
    { niu: 6, mul: 1 },         // 牛六
    { niu: 7, mul: 2 },         // 牛七
    { niu: 8, mul: 2 },         // 牛八
    { niu: 9, mul: 2 },         // 牛九
    { niu: 10, mul: 3 },        // 牛牛
    { niu: 11, mul: 4 },        // 四炸
    { niu: 12, mul: 5 },        // 五花牛
    { niu: 13, mul: 8 }         // 五小牛
];

// 所有牌
var CARDS = [
    101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113,        // 方块
    201, 202, 203, 204, 205, 206, 207, 208, 209, 210, 211, 212, 213,        // 梅花
    301, 302, 303, 304, 305, 306, 307, 308, 309, 310, 311, 312, 313,        // 红桃
    401, 402, 403, 404, 405, 406, 407, 408, 409, 410, 411, 412, 413         // 黑桃
];

// 张数
var COUNT = 5;

// 构造方法
var Logic = function () {
};

// 导出牌
Logic.TYPES = TYPES;
Logic.CARDS = CARDS;
Logic.COUNT = COUNT;

// 导出类
module.exports = Logic;

// 原型对象
var proto = Logic.prototype;

// 获取花色
proto.getColor = function (card) {
    return Math.floor(card / 100);
};

// 获取牌值
proto.getValue = function (card) {
    return card % 100;
};

// 逻辑牌值
proto.getLogic = function (card) {
    var val = card % 100;
    if (val > 10) {
        return 10;
    }
    return val;
};

// 获取牌型
proto.getType = function (array) {
    // 检查张数
    if (array.length < COUNT) {
        // 无牛
        return TYPES[0];
    }
    var cards = _.sortBy(array, this.getValue);
    // 判断五小牛
    if (this.getValue(cards[4]) < 10) {
        // 牌总点数
        let point = 0;
        for (let card of cards) {
            point += this.getLogic(card);
        }
        if (point <= 10) {
            // 五小牛
            return TYPES[13];
        }
    }
    // 判断五花牛
    if (this.getValue(cards[0]) > 10) {
        return TYPES[12];
    }
    // 判断四炸
    if (this.getValue(cards[0]) == this.getValue(cards[3]) || this.getValue(cards[1]) == this.getValue(cards[4])) {
        return TYPES[11];
    }
    // 牛牛判断
    var point = 0;
    for (let card of cards) {
        point += this.getLogic(card);
    }
    var mod = point % 10;
    if (0 == mod) {
        return TYPES[10];
    }
    // 牛X判断
    for (let i = 0; i < COUNT - 1; ++i) {
        for (let j = i + 1; j < COUNT; ++j) {
            if ((this.getLogic(cards[i]) + this.getLogic(cards[j])) % 10 == mod) {
                return TYPES[mod];
            }
        }
    }
    // 无牛
    return TYPES[0];
};

// 提取牌型
proto.extract = function (cards) {
    return { type: TYPES[0] };
};

// 比较手牌
proto.compare = function (handCards1, handCards2) {
    var type1 = handCards1.type;
    var type2 = handCards2.type;
    // 比较牌型
    if (type1.niu > type2.niu) {
        return true;
    }
    else if (type1.niu < type2.niu) {
        return false;
    }
    // 比较点数
    else {
        let self = this;
        let cards1 = _.sortBy(handCards1.cards, function (card) {
            return -self.getValue(card);
        });
        let cards2 = _.sortBy(handCards2.cards, function (card) {
            return -self.getValue(card);
        });
        // 比较点数
        for (let i = 0; i < COUNT; ++i) {
            if (this.getValue(cards1[i]) > this.getValue(cards2[i])) {
                return true;
            }
            else if (this.getValue(cards1[i]) < this.getValue(cards2[i])) {
                return false;
            }
        }
        // 比较花色
        for (let i = 0; i < COUNT; ++i) {
            if (this.getColor(cards1[i]) > this.getColor(cards2[i])) {
                return true;
            }
            else if (this.getColor(cards1[i]) < this.getColor(cards2[i])) {
                return false;
            }
        }
    }
    return false;
};

// 获取手牌
proto.randCard = function (lastCards) {
    var count = Math.floor(lastCards.length / COUNT);
    var start = _.random(0, count - 1) * COUNT;
    var cards = lastCards.slice(start, start + COUNT);
    return cards;
};

// 所有手牌
proto.getHandCards = function (users) {
    var handCards = [];
    var lastCards = _.shuffle(CARDS);
    for (let i = 0; i < users.length; ++i) {
        let cards = this.randCard(lastCards);
        lastCards = _.difference(lastCards, cards);
        handCards[i] = cards;
    }
    var self = this;
    handCards = handCards.map(function (cards) {
        if (cards) {
            let type = self.getType(cards);
            return { cards: cards, type: type, state: 0 };
        }
    });
    return handCards;
};