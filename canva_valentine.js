// 🎨 Canva Valentine's Day PPT Creator
// Copy-paste this into browser console (F12) on Canva.com

async function createValentinePPT() {
  console.log('💖 Creating Valentine\'s Day PPT on Canva...');
  
  try {
    // Step 1: Go directly to Valentine templates
    console.log('1️⃣ Navigating to Valentine templates...');
    await toolRegistry.execute('navigate', {
      url: 'https://www.canva.com/templates/?query=valentine+day+presentation'
    });
    
    // Wait for page load
    console.log('⏳ Waiting for templates to load...');
    await toolRegistry.execute('wait', { duration: 4000 });
    
    // Step 2: Click the first Valentine template
    console.log('2️⃣ Selecting first Valentine template...');
    
    // Try multiple selectors for Canva's template cards
    const selectors = [
      'a[href*="/design/"]',
      'div[data-test="template-card"] a',
      '.template-card a',
      'a[data-click-handler="templateCard"]',
      'div[role="button"][data-test*="template"]'
    ];
    
    let clicked = false;
    for (const selector of selectors) {
      try {
        const result = await toolRegistry.execute('click', { 
          selector,
          timeout: 5000 
        });
        if (result.success) {
          console.log(`✅ Clicked using selector: ${selector}`);
          clicked = true;
          break;
        }
      } catch (e) {
        console.log(`❌ Selector failed: ${selector}`);
      }
    }
    
    if (!clicked) {
      console.log('⚠️ Could not auto-click template. Please click a template manually.');
      console.log('💡 Then customize it with your message for her! 💖');
      return;
    }
    
    // Wait for editor to load
    console.log('⏳ Loading editor...');
    await toolRegistry.execute('wait', { duration: 3000 });
    
    console.log('✅ Template loaded!');
    console.log('💖 Now customize it:');
    console.log('   1. Add romantic text');
    console.log('   2. Upload photos of you two');
    console.log('   3. Change colors to her favorites');
    console.log('   4. Download when ready!');
    
  } catch (error) {
    console.error('❌ Error:', error);
    console.log('💡 Manual steps:');
    console.log('   1. Search "Valentine Day Presentation"');
    console.log('   2. Click any template you like');
    console.log('   3. Customize it for her 💖');
  }
}

// Run it!
createValentinePPT();
