
// remotestore handles the ajax calls to a remote message store.  the remote
// api should be relatively stable between different systems, though we could
// abstract this into multiple backend api's.

function quoted_printable_decode (str) {
    if (!str) return str;
    // http://kevin.vanzonneveld.net
    // +   original by: Ole Vrijenhoek
    // +   bugfixed by: Brett Zamir (http://brett-zamir.me)
    // +   reimplemented by: Theriault
    // +   improved by: Brett Zamir (http://brett-zamir.me)
    // +   bugfixed by: Theriault
    // *     example 1: quoted_printable_decode('a=3Db=3Dc');
    // *     returns 1: 'a=b=c'
    // *     example 2: quoted_printable_decode('abc  =20\r\n123  =20\r\n');
    // *     returns 2: 'abc   \r\n123   \r\n'
    // *     example 3: quoted_printable_decode('012345678901234567890123456789012345678901234567890123456789012345678901234=\r\n56789');
    // *     returns 3: '01234567890123456789012345678901234567890123456789012345678901234567890123456789'
    // *    example 4: quoted_printable_decode("Lorem ipsum dolor sit amet=23, consectetur adipisicing elit");
    // *    returns 4: Lorem ipsum dolor sit amet#, consectetur adipisicing elit
    // Removes softline breaks
    var RFC2045Decode1 = /=\r\n/gm,
        // Decodes all equal signs followed by two hex digits
        RFC2045Decode2IN = /=([0-9A-F]{2})/gim,
        // the RFC states against decoding lower case encodings, but following apparent PHP behavior
        // RFC2045Decode2IN = /=([0-9A-F]{2})/gm,
        RFC2045Decode2OUT = function (sMatch, sHex) {
            return String.fromCharCode(parseInt(sHex, 16));
        };
    return str.replace(RFC2045Decode1, '').replace(RFC2045Decode2IN, RFC2045Decode2OUT);
}


function assert(test, msg) {
    if (test !== true) throw msg;
}

var mail = {
    init: function(cb) {
        service.load('/api/schema', function(api) {
            //dump("api loaded\n");
            mail.api =  api;
            cb();
        });
    },

    labels: function(refresh, ok, err) {
        //dump("try to get lables\n");
        var account = accounts.current;
        var labels = accounts.get('labels', []);
        if (labels && labels.length > 0 && !refresh) {
            if (ok)
                ok(labels);
            return;
        }
        mail.api.storage.list_folders(account, function(data) {
            //dump("data: "+JSON.stringify(data)+"\n");
            labels = [];
            $.each(data.result, function(i) {
               var m = /^\{.+\}(.*)$/.exec(data.result[i]);
               if (m) {
                labels.push(m[1]);
               } else {
                labels.push(data.result[i]);
               }
            });
               
            accounts.set('labels', labels);
            if (ok)
                ok(labels);
        })
    },
    
    
    MESSAGES_NEW: 1,
    MESSAGES_MORE: 2,
    MESSAGES_REFRESH: 4,
    PAGE_SIZE: 25,
    messages: function(label, flags, index, search, ok, err) {
        //dump("get messages: ["+label+"] index "+index+" flags: "+flags+" search: ["+search+"]\n");
        if (label === "") {
            mail.labels(true, function(labels) {
                mail.messages(labels[0], flags, index, search, ok, err);
            })
            return;
        }
        var account = accounts.current;
        var messages = [];
        if (typeof(flags) === 'undefined')
            flags = 0;
        
        if (!(flags & this.MESSAGES_REFRESH)) {
            messages = accounts.get('messages:'+label, []);
        }
        if (messages.length > 0 && flags === 0) {
            if (ok)
                ok(messages);
            return;
        }
        
        var data = {
                name: label,
                username: account.username,
                password: account.password,
                flags: flags,
                start: index,
                num_msgs: this.PAGE_SIZE
            };
        if (search)
            data.search = search;

        mail.api.storage.list_messages(data, function(data) {
            //dump("data: "+JSON.stringify(data)+"\n");
            if (data.result === null)
                return;
            //dump("new messages: "+data.result.entries.length+"\n");
            
            if (flags & this.MESSAGES_NEW) {
                messages.unshift.apply(messages, data.result.entries);
            } else {
                messages.push.apply(messages, data.result.entries);
            }
            accounts.set('messages:'+label, messages);
            if (ok)
                ok(messages);
        });
    },
    processMessage: function(msg) {
        // select the primary part that will be shown as the message body
        if (!msg || !msg.parts)
            return msg;
        msg.body = msg.parts[0].body;
        msg.type = msg.parts[0].subtype;
        for (var p in msg.parts) {
            var part = msg.parts[p];
            if (part.subtype == "alternative") {
                // which subpart to show?
                var subparts = part.parts;
                for (var i in subparts) {
                    if (subparts[i].subtype == "html" ||
                        subparts[i].subtype == "plain") {
                        msg.type = subparts[i].subtype;
                        msg.body = subparts[i].body;
                    }
                }
            } else
            if (part.subtype == "html" ||
                part.subtype == "plain") {
                msg.type = part.subtype;
                msg.body = part.body;
            }
        }
        msg.body = quoted_printable_decode(msg.body);
        return msg;
    },
    message: function(id, ok, err) {
        var account = accounts.current;
        var indata = {
            username: account.username,
            password: account.password,
            mid: id
        };
        mail.api.storage.get_message(indata, function(data) {
            //dump(JSON.stringify(data)+"\n\n");
            var msg = mail.processMessage(data.result);
            //dump(JSON.stringify(msg)+"\n\n");
            if (ok)
                ok(msg);
        });        
    },
    send: function(indata) {
        $.extend(indata, accounts.current);
        mail.api.storage.send_message(indata, function(data) {
            //dump(JSON.stringify(data)+"\n\n");
            if (data.result === "ok")
                history.go(-1)
            else
                alert(data.error);
        });
    }
}



