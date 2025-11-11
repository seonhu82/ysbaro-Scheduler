const fetch = require('node-fetch')

async function testSummaryAPI() {
  try {
    const response = await fetch('http://localhost:3000/api/schedule/summary?year=2025&month=1')
    const result = await response.json()

    console.log('API Response Status:', response.status)
    console.log('\n=== Response Keys ===')
    console.log(Object.keys(result))

    if (result.success) {
      console.log('\n=== Period ===')
      console.log(result.period)

      console.log('\n=== Summary ===')
      console.log(result.summary)

      console.log('\n=== Week Summaries (data field) ===')
      if (result.data) {
        console.log(`Found ${result.data.length} weeks`)
        result.data.forEach(week => {
          console.log(`  Week ${week.weekNumber}: ${week.startDate} ~ ${week.endDate}`)
          console.log(`    Slots: ${week.assignedSlots}/${week.totalSlots}`)
        })
      } else {
        console.log('NO DATA FIELD!')
      }
    } else {
      console.log('ERROR:', result.error)
    }
  } catch (error) {
    console.error('Test failed:', error.message)
  }
}

testSummaryAPI()
