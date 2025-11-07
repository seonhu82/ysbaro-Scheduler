const fetch = require('node-fetch');

async function testJanuaryHolidays() {
  try {
    const response = await fetch('http://localhost:3000/api/schedule/monthly-view?year=2025&month=1');
    const data = await response.json();

    console.log('API Response status:', response.status);
    console.log('API success:', data.success);

    if (data.scheduleData) {
      console.log('\n=== January 2025 Schedule Data ===');
      const januaryDates = Object.keys(data.scheduleData)
        .filter(k => k.startsWith('2025-01'))
        .sort();

      console.log(`Total dates: ${januaryDates.length}`);
      console.log('\nFirst 10 dates:');
      januaryDates.slice(0, 10).forEach(dateKey => {
        const day = data.scheduleData[dateKey];
        console.log(`${dateKey}: holiday=${day.isHoliday}, holidayName=${day.holidayName || 'none'}, doctors=${day.doctorShortNames?.join(',') || 'none'}`);
      });

      // Check specific holidays
      console.log('\n=== Specific Holiday Check ===');
      ['2025-01-01', '2025-01-27', '2025-01-28', '2025-01-29', '2025-01-30'].forEach(dateKey => {
        const day = data.scheduleData[dateKey];
        if (day) {
          console.log(`${dateKey}: holiday=${day.isHoliday}, holidayName=${day.holidayName || 'none'}`);
        } else {
          console.log(`${dateKey}: NO DATA`);
        }
      });
    } else {
      console.log('No scheduleData:', data.error || 'unknown error');
    }
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

testJanuaryHolidays();
