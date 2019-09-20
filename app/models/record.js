'use strict';

module.exports = function (app) {
    var mdbgoose = app.memdb.goose;

    var everyRecordSchema = new mdbgoose.Schema({
        _id: { type: String },
        score: { type: Number }
    });

    var RecordSchema = new mdbgoose.Schema({
        _id: { type: String },
        start_time: { type: Number },
        table_id: { type: Number },
        table_jushu: { type: Number },
        before_jiesuan: { type: [everyRecordSchema] },
        jiesuan: { type: [everyRecordSchema] },
        result: { type: [everyRecordSchema] }
    }, { collection: 'ddz_record' });

    mdbgoose.model('DDZRecord', RecordSchema);

    var ToRecordSchema = new mdbgoose.Schema({
        _id: { type: String },
        time: { type: Number },
        name: { type: String },
        vip: { type: Number, default: 0 },
        is_get: { type: Number, default: 1 },
        score: { type: Number },
    }, { collection: 'to_record' });

    mdbgoose.model('TORecord', ToRecordSchema);
};

