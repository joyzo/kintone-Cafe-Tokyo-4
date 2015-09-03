/*
*
* 「kintoneを契約可能性」を返してくれるカスタマイズ
*   kintone.proxy()からAPI Gateway経由でLambda&Machine Learningをキックして、
*   リアルタイム予測値をセットする
*
* Dependencies:
*  <<JavaScript>>
*   - https://js.cybozu.com/jquery/1.11.3/jquery.min.js
*   - https://js.cybozu.com/spinjs/2.0.1/spin.min.js
*   - https://js.cybozu.com/sweetalert/v0.5.0/sweet-alert.min.js
*
*  <<CSS>>
*   - 51-us-default.css
*   - https://js.cybozu.com/sweetalert/v0.5.0/sweet-alert.css
*
*/

(function() {
  "use strict";

  // リアルタイム予測をキックするLambdaに紐ついたURL
  var LAMBDA_URL = 'https://tftgmky41k.execute-api.us-east-1.amazonaws.com/prod/predict-subscription/';
  // API-KEYの指定が必要な際は記入（指定が不要の際には''で空白指定）
  var API_KEY = 'JsjXDj0ojVazKoZL4oRSO3p9gXYZIPIA2B1tr9Iy';
  // リアルタイム予測に用いる説明変数のkey
  var PARAMS = ["age", "job", "marital", "education", "default", "housing", "loan", "contact", "month", "day_of_week", "duration", "campaign", "pdays", "previous", "poutcome", "emp_var_rate", "cons_price_idx", "cons_conf_idx", "euribor3m", "nr_employed"];

  // 予測値フィールドをdisabledにする
  kintone.events.on(['app.record.create.show', 'app.record.edit.show', 'app.record.index.edit.show'], function(event) {
    event.record['y_est'].disabled = true;
    // 再利用時には予測値フィールドをクリア
    if(event.reuse){
      event.record['y_est'].value = '';
    }
    return event;
  });

  // 詳細画面でリアルタイム予測を実行
  kintone.events.on(['app.record.detail.show'], function(event) {
    // リアルタイム予測と値の更新を行うボタンを設置
    if(event.record['y'].value == ''){
      // 購買実績値が未入力の際にはボタンを設置
      var el = kintone.app.record.getHeaderMenuSpaceElement();
      $(el).empty();
      $(el).append(
        $('<button>').prop('id', 'kintone-ml').addClass('kintoneplugin-button-normal').html('リアルタイム予測')
      );
    }else{
      // 購買実績値が入力済の際には予測は不要
      return;
    }

    // リアルタイム予測をキックするURLを作成
    var url = LAMBDA_URL;
    if(url.slice(-1) != '/'){ // urlの末尾に「/」がない場合追加
      url = url + '/';
    }
    var query = '?';
    for (var i = 0; i < PARAMS.length; i++) {
      if(event.record[PARAMS[i]].value != ''){
        query = query + PARAMS[i] + '=' + event.record[PARAMS[i]].value + '&';
      }
    }
    query = query.slice(0, -1);
    url = url + query;

    // ボタン押下時処理
    $('#kintone-ml').click(function() {
      showSpinner();
      kintone.proxy(url, 'GET', {
        "User-Agent": 'kintone.proxy()@' + location.hostname,
        "x-api-key": API_KEY
      }, {}, function(body, status, headers) {
        console.log(status, JSON.parse(body));
        var json = JSON.parse(body);
        var y_est = {};
        if (status != 200) { // kintone.proxy()によるリクエストエラー時
          hideSpinner();
          swal({
            title: 'リアルタイム予測値の取得に失敗しました。',
            text: (function() {
              if (json['message']) {
                return json['message'];
              }
            })(),
            type: 'error'
          }, function() {
            location.reload(true);
          });
          return;
        }
        if(json['Prediction']){ // LambdaとMLから予測値が得られなかった時
          y_est = json['Prediction']['predictedLabel'];
        }else{
          hideSpinner();
          swal({
            title: 'リアルタイム予測値の取得に失敗しました。',
            text: (function() {
              if (json['message']) {
                return json['message'];
              }
            })(),
            type: 'error'
          }, function() {
            location.reload(true);
          });
          return;
        }

        var put_record = {
          y_est: {
            value: y_est
          }
        };
        // 予測値を更新
        kintone.api(kintone.api.url('/k/v1/record', true), 'PUT', {
          app: kintone.app.getId(),
          id: kintone.app.record.getId(),
          record: put_record
        }, function(resp) {
          // 更新成功時
          hideSpinner();
          swal({
            title: '購買予測値を更新しました。',
            text: (function() {
              // 予測値が0の場合には申込見込がない
              return (y_est == 0) ? '契約してくれなさそうです。' : '契約してくれそうです。';
            })(),
            type: 'success'
          }, function() {
            location.reload(true);
          });
        }, function(err_resp) {
          // 更新失敗時
          hideSpinner();
          swal({
            title: '購買予測値を更新に失敗しました。',
            text: '',
            type: 'error'
          }, function() {
            location.reload(true);
          });
        });
      }, function(error) {
        hideSpinner();
        swal({
          title: 'リアルタイム予測値の取得に失敗しました。',
          text: '',
          type: 'error'
        }, function() {
          location.reload(true);
        });
      });
    });
    return event;
  });

  // スピナーを動作させる関数
  function showSpinner() {
    // 要素作成等初期化処理
    if ($('.kintone-spinner').length == 0) {
      // スピナー設置用要素と背景要素の作成
      var spin_div = $('<div id ="kintone-spin" class="kintone-spinner"></div>');
      var spin_bg_div = $('<div id ="kintone-spin-bg" class="kintone-spinner"></div>');
      // スピナー用要素をbodyにappend
      $(document.body).append(spin_div, spin_bg_div);
      // スピナー動作に伴うスタイル設定
      $(spin_div).css({
        'position': 'fixed',
        'top': '50%',
        'left': '50%',
        'z-index': '510',
        'background-color': '#fff',
        'padding': '26px',
        '-moz-border-radius': '4px',
        '-webkit-border-radius': '4px',
        'border-radius': '4px'
      });
      $(spin_bg_div).css({
        'position': 'fixed',
        'top': '0px',
        'z-index': '500',
        'width': '100%',
        'height': '200%',
        'background-color': '#000',
        'opacity': '0.5',
        'filter': 'alpha(opacity=50)',
        '-ms-filter': "alpha(opacity=50)"
      });
      // スピナーに対するオプション設定
      var opts = {
        'color': '#000'
      };
      // スピナーを作動
      new Spinner(opts).spin(document.getElementById('kintone-spin'));
    }
    // スピナー始動（表示）
    $('.kintone-spinner').show();
  }
  // スピナーを停止させる関数
  function hideSpinner() {
    // スピナー停止（非表示）
    $('.kintone-spinner').hide();
  }

})();
