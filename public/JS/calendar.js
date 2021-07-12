

document.addEventListener('DOMContentLoaded', function() {
    var calendarEl = document.getElementById('calendar');
  
    var calendar = new FullCalendar.Calendar(calendarEl, {
      selectable: true,
      themeSystem: 'bootstrap',
      headerToolbar: {
        left: 'prev,next today',
        center: 'title',
        right: 'dayGridMonth,timeGridWeek,listWeek'
      },
      dateClick: function(info) {
        // alert('clicked ' + info.dateStr);
      },
      select: function(info) {
        // alert('selected ' + info.startStr + ' to ' + info.endStr);
      },
      // events: [
      //   {
      //     title  : 'event1',
      //     start  : '2021-01-01'
      //   },
      //   {
      //     title  : 'event2',
      //     start  : '2021-01-05',
      //     end    : '2022-01-07'
      //   },
      //   {
      //     title  : 'event3',
      //     start  : '2021-01-09T12:30:00',
      //     allDay : false // will make the time show
      //   }
      // ]
    });
  
    calendar.render();
  });