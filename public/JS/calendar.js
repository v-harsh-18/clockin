

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
        
      },
      select: function(info) {
        // alert('selected ' + info.startStr + ' to ' + info.endStr);
      },
   
    });
  
    calendar.render();
  });
