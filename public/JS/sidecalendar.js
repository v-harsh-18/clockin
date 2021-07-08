document.addEventListener('DOMContentLoaded', function() {
    var calendarEl = document.getElementById('calendar2');
  
    var calendar = new FullCalendar.Calendar(calendarEl, {
      timeZone: 'UTC',
      initialView: 'dayGridMonth',
      editable: true,
      selectable: true
    });
  
    calendar.render();
  });