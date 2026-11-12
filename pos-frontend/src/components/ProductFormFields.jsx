// src/components/ProductFormFields.jsx — the fields shared by the Add and Edit product forms
import { Grid, TextField, MenuItem, Checkbox, FormControlLabel, Alert } from "@mui/material";

export const EMPTY_PRODUCT = {
  name: "", category_id: "", price: "", cost_price: "", stock: "", barcode: "",
  is_bulk_product: false, bulk_quantity: 48, bulk_price: "", unit_of_measure: "units"
};

const naira = (amount) => `₦${amount.toLocaleString('en-NG', { maximumFractionDigits: 2 })}`;

/** What the server needs: bulk fields are dropped when the product is not sold in packs. */
export const toProductPayload = (formData) => ({
  ...formData,
  bulk_quantity: formData.is_bulk_product ? formData.bulk_quantity : 1,
  bulk_price: formData.is_bulk_product && formData.bulk_price !== "" ? formData.bulk_price : null,
});

/** The server's reasons, e.g. "bulk_price: The pack price cannot be more than ...". */
export const productErrorMessage = (err) => {
  const data = err.response?.data;
  if (!data || typeof data !== 'object') return null;
  return Object.values(data).flat().join(' ');
};

const ProductFormFields = ({ formData, setFormData, categories }) => {
  const handleChange = (e) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const unit = formData.unit_of_measure || 'units';
  const loosePrice = parseFloat(formData.price) * parseInt(formData.bulk_quantity);
  const packPrice = parseFloat(formData.bulk_price);
  const packSaving = loosePrice - packPrice;

  return (
    <Grid container spacing={2}>
      <Grid size={{ xs: 12 }}>
        <TextField label="Product Name" name="name" fullWidth value={formData.name} onChange={handleChange} />
      </Grid>
      <Grid size={{ xs: 12 }}>
        <TextField select label="Category" name="category_id" fullWidth value={formData.category_id} onChange={handleChange}>
          {categories.map(cat => (
            <MenuItem key={cat.id} value={cat.id}>{cat.name}</MenuItem>
          ))}
        </TextField>
      </Grid>
      <Grid size={{ xs: 6 }}>
        <TextField label="Selling price (1 item)" name="price" type="number" fullWidth value={formData.price} onChange={handleChange} />
      </Grid>
      <Grid size={{ xs: 6 }}>
        <TextField label="Cost price (1 item)" name="cost_price" type="number" fullWidth value={formData.cost_price} onChange={handleChange} />
      </Grid>
      <Grid size={{ xs: 6 }}>
        <TextField
          label="Stock"
          name="stock"
          type="number"
          fullWidth
          value={formData.stock}
          onChange={handleChange}
          helperText={formData.is_bulk_product ? `Count single ${unit}, not packs` : undefined}
        />
      </Grid>
      <Grid size={{ xs: 6 }}>
        <TextField label="Barcode" name="barcode" fullWidth value={formData.barcode} onChange={handleChange} />
      </Grid>
      <Grid size={{ xs: 12 }}>
        <TextField
          label="Unit of measure"
          name="unit_of_measure"
          fullWidth
          value={formData.unit_of_measure}
          onChange={handleChange}
          helperText="e.g. pieces, kg, bottles"
        />
      </Grid>
      <Grid size={{ xs: 12 }}>
        <FormControlLabel
          control={
            <Checkbox
              checked={formData.is_bulk_product}
              onChange={(e) => setFormData(prev => ({ ...prev, is_bulk_product: e.target.checked }))}
              name="is_bulk_product"
            />
          }
          label="Also sold in packs (carton, crate, bag)"
        />
      </Grid>
      {formData.is_bulk_product && (
        <>
          <Grid size={{ xs: 6 }}>
            <TextField
              label={`${unit} per pack`}
              name="bulk_quantity"
              type="number"
              fullWidth
              value={formData.bulk_quantity}
              onChange={handleChange}
            />
          </Grid>
          <Grid size={{ xs: 6 }}>
            <TextField
              label="Price for 1 pack"
              name="bulk_price"
              type="number"
              fullWidth
              value={formData.bulk_price}
              onChange={handleChange}
            />
          </Grid>
          {loosePrice > 0 && packPrice > 0 && (
            <Grid size={{ xs: 12 }}>
              <Alert severity={packSaving < 0 ? "error" : "info"}>
                {formData.bulk_quantity} single {unit} cost {naira(loosePrice)}.{" "}
                {packSaving > 0 && `A pack saves the customer ${naira(packSaving)}.`}
                {packSaving === 0 && "A pack costs the same as buying them one by one."}
                {packSaving < 0 && "A pack cannot cost more than buying them one by one."}
              </Alert>
            </Grid>
          )}
        </>
      )}
    </Grid>
  );
};

export default ProductFormFields;
