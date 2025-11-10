const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/app/(public)/leave-apply/[token]/page.tsx');

let content = fs.readFileSync(filePath, 'utf8');

// submit API를 submit-v3로 변경
content = content.replace(
  '/api/leave-apply/${params.token}/submit',
  '/api/leave-apply/${params.token}/submit-v3'
);

// 에러 메시지 처리 개선
content = content.replace(
  `errors.push(\`\${app.date}: \${result.error || '실패'}\`)`,
  `// 동적 제한 시스템의 상세 에러 메시지 사용
            const errorMsg = result.userMessage
              ? \`\${result.userMessage.title}\\n\${result.userMessage.message}\\n💡 \${result.userMessage.suggestion}\`
              : result.error || '실패'
            errors.push(\`\${app.date}: \${errorMsg}\`)`
);

fs.writeFileSync(filePath, content, 'utf8');

console.log('✅ API endpoint updated to submit-v3');
console.log('✅ Error message handling improved');
