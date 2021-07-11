document.addEventListener('DOMContentLoaded', function() {
    // var calendarEl = document.getElementById('calendar2');
  
    // var calendar = new FullCalendar.Calendar(calendarEl, {
    //   timeZone: 'UTC',
    //   initialView: 'dayGridMonth',
    //   editable: true,
    //   selectable: true
    // });

    new Vue({
      el: '#app',
      data: {
        selectedDate: null,
        return: {
          date: new Date(),
        }
      }
      
    });
    
  
    // calendar.render();
  });

  
  