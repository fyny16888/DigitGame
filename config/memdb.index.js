'use strict';

module.exports =  {
	// Collection name
    shop : {
        // Index setting, modify it on your need
        indexes : [
            {
                // Index keys
                keys : ['type']
            }
        ]
    },
    player : {
        // Index setting, modify it on your need
        indexes : [
            {
                // Index keys
                keys : ['account'],
                unique: true
            },
            {
				// Index keys
				keys : ['spreader'],
				valueIgnore : {
					spreader: ['']
                }
            }
        ]
    },
    pay_records: {
        // Index setting, modify it on your need
        indexes : [
            {
                // Index keys
                keys : ['uid']
            }
        ]
    }
};
