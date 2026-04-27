import { CartItem } from '../types';

export const saveToSheets = async (orderData: {
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  items: CartItem[];
  total: number;
}, accessToken: string) => {
  // We'll try to find a spreadsheet named 'Den Ana Orders' or create a new one
  // For simplicity in this demo, we'll ask the user to provide a spreadsheet ID or we'll create one.
  // The user workflow in AGENTS.md/SKILL.md suggests we should handle this gracefully.
  
  const SPREADSHEET_NAME = 'Den Ana Digital Catalog Orders';
  
  try {
    // 1. Search for existing spreadsheet
    const searchRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=name='${SPREADSHEET_NAME}' and mimeType='application/vnd.google-apps.spreadsheet'`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const searchData = await searchRes.json();
    
    let spreadsheetId = '';
    
    if (searchData.files && searchData.files.length > 0) {
      spreadsheetId = searchData.files[0].id;
    } else {
      // 2. Create new spreadsheet if not found
      const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          properties: { title: SPREADSHEET_NAME }
        })
      });
      const createData = await createRes.json();
      spreadsheetId = createData.spreadsheetId;
      
      // 3. Initialize headers
      await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Sheet1!A1:F1?valueInputOption=RAW`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          values: [['Tanggal', 'Nama Pelanggan', 'WhatsApp', 'Alamat', 'Pesanan', 'Total']]
        })
      });
    }
    
    // 4. Append order data
    const orderDetails = orderData.items.map(item => `${item.name} (${item.quantity}x)`).join(', ');
    const row = [
      new Date().toLocaleString(),
      orderData.customerName,
      orderData.customerPhone,
      orderData.customerAddress,
      orderDetails,
      orderData.total
    ];
    
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Sheet1!A:A:append?valueInputOption=USER_ENTERED`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        values: [row]
      })
    });
    
    return spreadsheetId;
  } catch (error) {
    console.error('Error saving to sheets:', error);
    throw error;
  }
};
