

document.addEventListener('DOMContentLoaded', function() {
    var calendarEl = document.getElementById('calendar');
    var x = document.getElementById("yy").innerHTML;
    console.log(x);
    var calendar = new FullCalendar.Calendar(calendarEl, {
      selectable: true,
      themeSystem: 'bootstrap',
      headerToolbar: {
        left: 'prev,next today',
        center: 'title',
        right: 'dayGridMonth,timeGridWeek,listWeek'
      },
      events: x ,
      dateClick: function(info) {

      },
      select: function(info) {
        // alert('selected ' + info.startStr + ' to ' + info.endStr);
      },
   
    });
  
    calendar.render();
  });

