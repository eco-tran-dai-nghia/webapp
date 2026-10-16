/**
 * Lịch chạy tự động (mỗi 10 phút): nhắc task, nhắc seeding, gửi thư hẹn giờ, dọn thông báo cũ.
 */

function installTriggers() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'tick') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('tick').timeBased().everyMinutes(10).create();
}

function tick() {
  var jobs = [
    typeof remindTasks_ === 'function' ? remindTasks_ : null,
    typeof remindSeeding_ === 'function' ? remindSeeding_ : null,
    typeof sendScheduledMail_ === 'function' ? sendScheduledMail_ : null,
    typeof cleanNotifications_ === 'function' ? cleanNotifications_ : null,
    typeof cleanSnapshots_ === 'function' ? cleanSnapshots_ : null
  ];
  jobs.forEach(function (f) {
    if (!f) return;
    try { f(); } catch (e) { console.error(e && e.stack || e); }
    DB_MEMO_ = {};
  });
}
