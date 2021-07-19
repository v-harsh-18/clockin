document.addEventListener('DOMContentLoaded', function () {
  new Vue({
    el: '#app',
    data() {
      return {
        attributes: [
          {
            dot: 'red',
            dates: [
              '2021-07-22',
              new Date(2018, 0, 1), // Jan 1sst
            ],
          },
          {
            dot: 'yellow',
            dates: [
            '2021-07-04', // Jan 4th
              new Date(2018, 0, 10), // Jan 10th
              new Date(2018, 0, 15), // Jan 15th
            ],
          },
          {
            dot: 
              'pink'
              ,
            dates: [
              new Date(2018, 0, 12), // Jan 12th
              new Date(2018, 0, 26), // Jan 26th
              new Date(2018, 0, 15), // Jan 15th
            ],
          },
        ],
      };
    }

  });

});


