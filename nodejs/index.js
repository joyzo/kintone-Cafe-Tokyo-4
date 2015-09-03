var aws = require('aws-sdk');
var machinelearning = new aws.MachineLearning();
var MLModelId = '{MLModelId}';
var params = {
  MLModelId: MLModelId
};

exports.handler = function(event, context) {
  machinelearning.getMLModel(params, function(err, data) {
    if (err) {
      console.log(err, err.stack);
    } else {
      console.log('===============<< event.queryParameters >>===============');
      console.log(event.queryParameters);
      console.log('===============<< event.queryParameters >>===============');
      var Record = {};
      for (var key in event.queryParameters) {
        Record[key] = event.queryParameters[key]
      }
      var params = {
        MLModelId: MLModelId,
        PredictEndpoint: data.EndpointInfo.EndpointUrl,
        Record: Record
      };
      machinelearning.predict(params, function(err, data) {
        if (err) {
          console.log(err, err.stack);
        } else {
          console.log('===============<< result of ML>>===============');
          console.log(data);
          console.log('===============<< result of ML >>===============');
          context.succeed(data);
        }
      });
    }
  });
};
