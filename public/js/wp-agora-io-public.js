// https://www.paulirish.com/2009/throttled-smartresize-jquery-event-handler/
(function($,sr){

  // debouncing function from John Hann
  // http://unscriptable.com/index.php/2009/03/20/debouncing-javascript-methods/
  var debounce = function (func, threshold, execAsap) {
      var timeout;

      return function debounced () {
          var obj = this, args = arguments;
          function delayed () {
              if (!execAsap)
                  func.apply(obj, args);
              timeout = null;
          };

          if (timeout)
              clearTimeout(timeout);
          else if (execAsap)
              func.apply(obj, args);

          timeout = setTimeout(delayed, threshold || 150);
      };
  }
  // smartresize 
  jQuery.fn[sr] = function(fn){  return fn ? this.bind('resize', debounce(fn)) : this.trigger(sr); };

})(jQuery,'smartresize');


function agora_getUserAvatar(user_id, cb) {
  var uid = String(user_id).substring(3);
  console.log('Real WP user ID:', uid)
  var params = {
    action: 'get_user_avatar', // wp ajax action
    uid, // needed to get the avatar from the WP user
  };
  agoraApiRequest(ajax_url, params).done(function(data) {
    if (cb) {
      cb(data);
    }
  }).fail(function(err) {
    console.error('Avatar not available:', err);
  });
}