'use strict';

module.exports = function (app) {
    var mdbgoose = app.memdb.goose;

    var PayRecordSchema = new mdbgoose.Schema({
        _id: { type: String },                                  // 订单号
        account: { type: String },                              // 玩家账户 
        shopId: { type: Number },								// 商品Id
        total_fee: { type: Number },							// 总金额
        time: { type: Number, default: Date.now }				// 时间戳
    }, { collection: 'pay_records' });

    mdbgoose.model('PayRecord', PayRecordSchema);

    var ExchangeRecordSchema = new mdbgoose.Schema({
        _id: { type: String },                                  // 转账订单
        account: { type: String },                              // 玩家账户
        backRmb: { type: Number },                              // 返还RMB
        time: { type: Number, default: Date.now }				// 时间戳
    }, { collection: 'exchange_records' });

    mdbgoose.model('ExchangeRecord', ExchangeRecordSchema);

    var payDayRecordSchema = new mdbgoose.Schema({
        _id: { type: String },
        time: { type: Number },
        total_fee: { type: Number },
    }, { collection: 'day_pay_record' });

    mdbgoose.model('PayDayRecord', payDayRecordSchema);

    var baiduOrderSchema = new mdbgoose.Schema({
        _id: { type: String },
        playerId: { type: String },
        name: { type: String },
        money: { type: Number },
        status: { type: Number, default: 0 },
        shopId: { type: Number }
    }, { collection: 'baidu_order' });

    mdbgoose.model('BaiduOrderSchema', baiduOrderSchema);
};

