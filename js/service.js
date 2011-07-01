
/**
 * service loader
 *
 * uses json-schema api descriptions to generate an api interface
 **/
var service = {
    load: function(schemaUrl, cb) {
        var self = this;
        $.ajax({
            url: schemaUrl,
            type: "GET",
            success: function(data, textStatus, jqXHR) {
                //dump("data: "+JSON.stringify(data)+"\n");
                cb(service.build(data, data));
            },
            error: function(jqXHR, errorStr, ex) {
            }
        });
    },
    
    create_method: function(method, schema) {
        return function(data, cb, err) {
                service.callMethod(method, schema, data, cb, err);
            };
    },

    build: function(res, schema) {
        var col = {};
        var key;
        for (key in res.resources) {
            col[key] = service.build(res.resources[key], schema);
        }
        for (key in res.methods) {
            col[key] = service.create_method(res.methods[key], schema);
        }
        return col;
    },

    interpolatePath: function(path, data) {
        var m = path.match(/{(.*?)}/g);
        for (var i in m) {
            var n = m[i].slice(1,-1);
            if (data[n]) {
                path = path.replace(m[i], data[n]);
                delete data[n];
            }
        }
        return path;
    },

    callMethod: function(method, schema, data, cb, err) {
        var path = service.interpolatePath(schema.basePath + method.path, data);
        //dump("calling "+path+" with "+JSON.stringify(data)+"\n");

        $.ajax({
            url: path,
            type: method.httpMethod,
            data: data,
            success: cb,
            error: err
        });        
    }
}
